import { toEpochMs } from "./query";

type Fields = Record<string, unknown>;

interface IndexOptions {
  indexes?: Array<{ fields: readonly string[]; unique?: boolean; ttlSeconds?: number }>;
}

/** Indexed field values per document, valid while the file mtime is unchanged */
export class IndexCache {
  readonly fields: string[];
  readonly unique: string[][];
  private readonly ttl: Array<{ field: string; ms: number }>;
  private readonly entries = new Map<string, { mtimeMs: number; values: Fields }>();

  constructor(options: IndexOptions = {}) {
    const indexes = (options.indexes ?? []).map((i) => ({ ...i, fields: [...i.fields] }));
    this.fields = [...new Set(indexes.flatMap((i) => i.fields))];
    this.unique = indexes.filter((i) => i.unique).map((i) => i.fields);
    this.ttl = indexes
      .filter((i) => i.ttlSeconds !== undefined && i.fields.length > 0)
      .map((i) => ({ field: i.fields[0], ms: (i.ttlSeconds ?? 0) * 1000 }));
  }

  /** True when a filter on these keys can be decided from cached values alone */
  covers(keys: string[]): boolean {
    return keys.length > 0 && keys.every((k) => this.fields.includes(k));
  }

  remember(id: string, mtimeMs: number, doc: object): void {
    if (this.fields.length === 0) return;
    const fields = doc as Fields;
    this.entries.set(id, { mtimeMs, values: Object.fromEntries(this.fields.map((f) => [f, fields[f]])) });
  }

  forget(id: string): void {
    this.entries.delete(id);
  }

  lookup(id: string, mtimeMs: number): Fields | undefined {
    const entry = this.entries.get(id);
    return entry?.mtimeMs === mtimeMs ? entry.values : undefined;
  }

  isExpired(doc: object | null): boolean {
    if (!doc || this.ttl.length === 0) return false;
    const now = Date.now();
    return this.ttl.some(({ field, ms }) => {
      const at = toEpochMs((doc as Fields)[field]);
      return at !== null && at + ms <= now;
    });
  }
}
