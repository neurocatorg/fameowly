/** Thrown by `insert`, `upsert` and `update` when an id or a unique index is already taken */
export class DuplicateKeyError extends Error {
  readonly code = "DUPLICATE_KEY";

  constructor(
    readonly collection: string,
    readonly fields: string[],
  ) {
    super(`Duplicate key in "${collection}": ${fields.join(", ")}`);
    this.name = "DuplicateKeyError";
  }
}
