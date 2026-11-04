/**
 * In-memory evaluation of the document-store query language:
 * filters, sorting and update specs. Backend-neutral.
 */

import { isDeepStrictEqual } from "util";
import type { Filter, SortSpec, UpdateSpec } from "../contracts/document-store";

type Fields = Record<string, unknown>;

const OPERATORS = new Set(["$in", "$gt", "$gte", "$lt", "$lte", "$exists"]);

function isOperatorObject(value: unknown): value is Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => k.startsWith("$"));
}

/** Missing < number < string < boolean < everything else */
function typeRank(value: unknown): number {
  if (value === undefined || value === null) return 0;
  switch (typeof value) {
    case "number":
      return 1;
    case "string":
      return 2;
    case "boolean":
      return 3;
    default:
      return 4;
  }
}

export function compareValues(a: unknown, b: unknown): number {
  const rank = typeRank(a) - typeRank(b);
  if (rank !== 0) return rank;
  if (typeof a === "number" || typeof a === "string" || typeof a === "boolean") {
    if (a === b) return 0;
    return a < (b as typeof a) ? -1 : 1;
  }
  return 0;
}

function equals(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  return isDeepStrictEqual(actual, expected);
}

function comparable(actual: unknown, operand: unknown): boolean {
  return actual !== undefined && actual !== null && typeRank(actual) === typeRank(operand);
}

function matchesOperators(actual: unknown, operators: Fields): boolean {
  for (const [op, operand] of Object.entries(operators)) {
    if (!OPERATORS.has(op)) throw new Error(`Unsupported filter operator: ${op}`);
    if (operand === undefined) continue;
    const ok =
      op === "$exists"
        ? (actual !== undefined) === operand
        : op === "$in"
          ? (operand as unknown[]).some((v) => equals(actual, v))
          : comparable(actual, operand) && compareOp(op, compareValues(actual, operand));
    if (!ok) return false;
  }
  return true;
}

function compareOp(op: string, order: number): boolean {
  switch (op) {
    case "$gt":
      return order > 0;
    case "$gte":
      return order >= 0;
    case "$lt":
      return order < 0;
    default:
      return order <= 0;
  }
}

export function matchesFilter<T>(doc: T, filter: Filter<T>): boolean {
  const fields = doc as Fields;
  for (const [key, expected] of Object.entries(filter)) {
    if (expected === undefined) continue;
    const actual = fields[key];
    const ok = isOperatorObject(expected) ? matchesOperators(actual, expected) : equals(actual, expected);
    if (!ok) return false;
  }
  return true;
}

export function sortDocs<T>(docs: T[], sort: SortSpec<T> | undefined): T[] {
  const keys = Object.entries(sort ?? {}) as Array<[string, 1 | -1]>;
  if (keys.length === 0) return docs;
  return [...docs].sort((a, b) => {
    for (const [key, direction] of keys) {
      const order = compareValues((a as Fields)[key], (b as Fields)[key]);
      if (order !== 0) return order * direction;
    }
    return 0;
  });
}

export function applyUpdate<T extends { id: string }>(doc: T, spec: UpdateSpec<T>): T {
  const next = structuredClone(doc) as Fields;
  for (const [key, value] of Object.entries(spec.set ?? {})) {
    if (key !== "id" && value !== undefined) next[key] = value;
  }
  for (const key of spec.unset ?? []) {
    if (key !== "id") delete next[key as string];
  }
  for (const [key, delta] of Object.entries(spec.inc ?? {})) {
    const current = next[key] ?? 0;
    if (typeof current !== "number" || typeof delta !== "number") {
      throw new Error(`Cannot increment non-numeric field "${key}"`);
    }
    next[key] = current + delta;
  }
  return next as T;
}

/** Epoch ms of a TTL field value, or null when it holds no date */
export function toEpochMs(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}
