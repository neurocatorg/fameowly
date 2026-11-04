/**
 * Transactions for the file backend.
 *
 * Transactions run one at a time. A collection touched inside one stays locked
 * until it ends, so single writes to it wait; the first write of each document
 * keeps its previous content for rollback. Rollback is in-process only: a crash
 * mid-transaction leaves the writes made so far.
 */

import { AsyncLocalStorage } from "async_hooks";
import { Mutex } from "./mutex";
import { readRawFile, removeFile, writeFileAtomic } from "./file-io";

export class FileTransaction {
  private readonly locks = new Map<Mutex, Promise<() => void>>();
  private readonly originals = new Map<string, Promise<string | null>>();
  private closed = false;

  get active(): boolean {
    return !this.closed;
  }

  /** Idempotent and safe for parallel calls within the transaction */
  async lock(mutex: Mutex): Promise<void> {
    let held = this.locks.get(mutex);
    if (!held) {
      held = mutex.acquire();
      this.locks.set(mutex, held);
    }
    await held;
  }

  /** Must complete before the first write to `file` */
  async keepOriginal(file: string): Promise<void> {
    let original = this.originals.get(file);
    if (!original) {
      original = readRawFile(file);
      this.originals.set(file, original);
    }
    await original;
  }

  async rollback(): Promise<void> {
    for (const [file, original] of this.originals) {
      const content = await original;
      if (content === null) await removeFile(file);
      else await writeFileAtomic(file, content);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const held of this.locks.values()) (await held)();
  }
}

const CONTEXT = Symbol.for("ai-router.storage.file-transaction");
type ContextHolder = { [CONTEXT]?: AsyncLocalStorage<FileTransaction> };

function context(): AsyncLocalStorage<FileTransaction> {
  const holder = globalThis as ContextHolder;
  return (holder[CONTEXT] ??= new AsyncLocalStorage<FileTransaction>());
}

/** The transaction the caller runs in; work left running after it ended does not count */
export function currentTransaction(): FileTransaction | undefined {
  const tx = context().getStore();
  return tx?.active ? tx : undefined;
}

export async function runTransaction<R>(serial: Mutex, fn: () => Promise<R>): Promise<R> {
  if (currentTransaction()) return fn();
  return serial.run(async () => {
    const tx = new FileTransaction();
    try {
      return await context().run(tx, fn);
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      await tx.close();
    }
  });
}
