/** FIFO async mutex; `acquire` resolves with the release function */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const ready = this.tail.then(() => release);
    this.tail = this.tail.then(() => held);
    return ready;
  }

  async run<R>(fn: () => Promise<R>): Promise<R> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const REGISTRY = Symbol.for("ai-router.storage.mutexes");
type Registry = { [REGISTRY]?: Map<string, Mutex> };

/**
 * One mutex per key for the whole process. Kept on globalThis because Next.js
 * may load a module once per bundle, and two locks for one file lock nothing.
 */
export function sharedMutex(key: string): Mutex {
  const holder = globalThis as Registry;
  const registry = (holder[REGISTRY] ??= new Map());
  let mutex = registry.get(key);
  if (!mutex) {
    mutex = new Mutex();
    registry.set(key, mutex);
  }
  return mutex;
}
