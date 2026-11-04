/**
 * One collection of the file backend: `<dir>/<id>.json` per document.
 *
 * Indexed field values are cached per file mtime, so filters on indexed fields
 * read only matching documents and hand edits to the files are still picked up.
 */

import path from "path";
import type {
  Collection,
  CollectionOptions,
  Filter,
  FindOptions,
  StoredDocument,
  UpdateSpec,
} from "../contracts/document-store";
import { DuplicateKeyError } from "./errors";
import { sharedMutex, type Mutex } from "./mutex";
import { currentTransaction } from "./file-transaction";
import { IndexCache } from "./file-index-cache";
import { applyUpdate, matchesFilter, sortDocs } from "./query";
import {
  assertSafeName,
  fileMtime,
  isSafeName,
  listDocIds,
  readDocFile,
  removeFile,
  serializeDoc,
  writeFileAtomic,
} from "./file-io";

export class FileCollection<T extends StoredDocument> implements Collection<T> {
  private readonly lock: Mutex;
  private readonly index: IndexCache;

  constructor(
    private readonly name: string,
    private readonly dir: string,
    options: CollectionOptions<T> = {},
  ) {
    this.lock = sharedMutex(dir);
    this.index = new IndexCache(options);
  }

  async get(id: string): Promise<T | null> {
    if (!isSafeName(id)) return null;
    const doc = await this.shared(() => this.readDoc(id));
    if (!this.index.isExpired(doc)) return doc;
    await this.purge([id]);
    return null;
  }

  async findOne(filter: Filter<T>, options: Omit<FindOptions<T>, "limit"> = {}): Promise<T | null> {
    return (await this.find(filter, { ...options, limit: 1 }))[0] ?? null;
  }

  async find(filter: Filter<T> = {}, options: FindOptions<T> = {}): Promise<T[]> {
    const { docs, expired } = await this.shared(() => this.scan(filter));
    await this.purge(expired);
    const start = options.skip ?? 0;
    const end = options.limit === undefined ? undefined : start + options.limit;
    return sortDocs(docs, options.sort).slice(start, end);
  }

  async count(filter: Filter<T> = {}): Promise<number> {
    return (await this.find(filter)).length;
  }

  async insert(doc: T): Promise<T> {
    assertSafeName("id", doc.id);
    return this.exclusive(async () => {
      const existing = await this.readDoc(doc.id);
      if (existing && !this.index.isExpired(existing)) throw new DuplicateKeyError(this.name, ["id"]);
      return this.write(doc);
    });
  }

  async upsert(doc: T): Promise<T> {
    assertSafeName("id", doc.id);
    return this.exclusive(() => this.write(doc));
  }

  async update(id: string, spec: UpdateSpec<T>): Promise<T | null> {
    if (!isSafeName(id)) return null;
    return this.exclusive(async () => {
      const doc = await this.readDoc(id);
      if (!doc || this.index.isExpired(doc)) return null;
      return this.write(applyUpdate(doc, spec));
    });
  }

  async delete(id: string): Promise<boolean> {
    if (!isSafeName(id)) return false;
    return this.exclusive(() => this.remove(id));
  }

  async deleteMany(filter: Filter<T>): Promise<number> {
    return this.exclusive(async () => {
      const { docs, expired } = await this.scan(filter);
      for (const id of [...docs.map((d) => d.id), ...expired]) await this.remove(id);
      return docs.length;
    });
  }

  private async exclusive<R>(fn: () => Promise<R>): Promise<R> {
    const tx = currentTransaction();
    if (!tx) return this.lock.run(fn);
    await tx.lock(this.lock);
    return fn();
  }

  /** Reads take no lock, except inside a transaction, which isolates read-modify-write */
  private async shared<R>(fn: () => Promise<R>): Promise<R> {
    await currentTransaction()?.lock(this.lock);
    return fn();
  }

  private file(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private async readDoc(id: string): Promise<T | null> {
    const read = await readDocFile<T>(this.file(id));
    if (!read) {
      this.index.forget(id);
      return null;
    }
    this.index.remember(id, read.mtimeMs, read.doc);
    return read.doc;
  }

  /** Indexed values of a document, read from disk only when the file changed */
  private async indexedValues(id: string): Promise<object | null> {
    const mtimeMs = await fileMtime(this.file(id));
    if (mtimeMs === null) return null;
    return this.index.lookup(id, mtimeMs) ?? (await this.readDoc(id));
  }

  private async scan(filter: Filter<T>): Promise<{ docs: T[]; expired: string[] }> {
    const byIndex = this.index.covers(Object.keys(filter));
    const docs: T[] = [];
    const expired: string[] = [];

    await Promise.all(
      (await listDocIds(this.dir)).map(async (id) => {
        if (byIndex) {
          const values = await this.indexedValues(id);
          if (!values || this.index.isExpired(values) || !matchesFilter(values as T, filter)) return;
        }
        const doc = await this.readDoc(id);
        if (!doc) return;
        if (this.index.isExpired(doc)) expired.push(id);
        else if (matchesFilter(doc, filter)) docs.push(doc);
      }),
    );
    docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { docs, expired };
  }

  private async assertUnique(doc: T): Promise<void> {
    const fields = doc as unknown as Record<string, unknown>;
    for (const index of this.index.unique) {
      if (index.some((f) => fields[f] === undefined || fields[f] === null)) continue;
      const filter = Object.fromEntries(index.map((f) => [f, fields[f]])) as Filter<T>;
      const { docs } = await this.scan(filter);
      if (docs.some((d) => d.id !== doc.id)) throw new DuplicateKeyError(this.name, index);
    }
  }

  private async write(doc: T): Promise<T> {
    await this.assertUnique(doc);
    await currentTransaction()?.keepOriginal(this.file(doc.id));
    const mtimeMs = await writeFileAtomic(this.file(doc.id), serializeDoc(doc));
    this.index.remember(doc.id, mtimeMs, doc);
    return doc;
  }

  private async remove(id: string): Promise<boolean> {
    await currentTransaction()?.keepOriginal(this.file(id));
    this.index.forget(id);
    return removeFile(this.file(id));
  }

  /** Lazy TTL cleanup; re-checks expiry under the lock in case of a concurrent rewrite */
  private async purge(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.exclusive(async () => {
      for (const id of ids) {
        if (this.index.isExpired(await this.readDoc(id))) await this.remove(id);
      }
    });
  }
}
