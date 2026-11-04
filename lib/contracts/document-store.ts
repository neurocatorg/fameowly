/**
 * Contract: document collections — the single storage abstraction.
 *
 * Every module declares the collections it needs; the core knows nothing
 * about plugin entities. The OSS backend keeps one JSON file per document.
 */

export interface StoredDocument {
  /** Letters, digits, `.`, `_`, `-`; starts with a letter or digit; at most 200 chars */
  id: string;
}

export interface ComparisonOperators<V> {
  $in?: V[];
  $gt?: V;
  $gte?: V;
  $lt?: V;
  $lte?: V;
  $exists?: boolean;
}

/** Top-level fields only: equality or comparison operators, all conditions ANDed */
export type Filter<T> = {
  [K in keyof T]?: T[K] | ComparisonOperators<NonNullable<T[K]>>;
};

export type SortSpec<T> = { [K in keyof T]?: 1 | -1 };

export interface FindOptions<T> {
  /** Missing values sort first in ascending order */
  sort?: SortSpec<T>;
  limit?: number;
  skip?: number;
}

type NumericKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends number ? K : never;
}[keyof T];

export interface UpdateSpec<T> {
  set?: Partial<Omit<T, "id">>;
  unset?: Array<Exclude<keyof T, "id">>;
  /** A missing field counts as 0 */
  inc?: { [K in NumericKeys<T>]?: number };
}

export interface IndexSpec<T> {
  fields: Array<keyof T & string>;
  /** Documents missing any of the fields are exempt from the constraint */
  unique?: boolean;
  /**
   * Expire documents `ttlSeconds` after the date in `fields[0]`
   * (ISO string or epoch milliseconds). Expired documents are never returned.
   */
  ttlSeconds?: number;
}

export interface CollectionOptions<T> {
  indexes?: IndexSpec<T>[];
}

export interface Collection<T extends StoredDocument> {
  get(id: string): Promise<T | null>;
  findOne(filter: Filter<T>, options?: Omit<FindOptions<T>, "limit">): Promise<T | null>;
  find(filter?: Filter<T>, options?: FindOptions<T>): Promise<T[]>;
  count(filter?: Filter<T>): Promise<number>;
  /** Rejects with `DuplicateKeyError` when the id or a unique index is taken */
  insert(doc: T): Promise<T>;
  /** Replaces the whole document */
  upsert(doc: T): Promise<T>;
  /** Atomic; resolves to the updated document, or null when there is none */
  update(id: string, spec: UpdateSpec<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  /** Resolves to the number of deleted documents */
  deleteMany(filter: Filter<T>): Promise<number>;
}

export interface DocumentStore {
  /** Declare a collection once per module; options of the first declaration win */
  collection<T extends StoredDocument>(name: string, options?: CollectionOptions<T>): Collection<T>;
  /**
   * Run `fn` atomically: all writes are rolled back when it throws.
   * Nested calls join the outer transaction.
   */
  transaction<R>(fn: (tx: DocumentStore) => Promise<R>): Promise<R>;
}
