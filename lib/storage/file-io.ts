import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/** Ids and collection names become file names: no separators, no `..` */
export function isSafeName(value: unknown): value is string {
  return typeof value === "string" && SAFE_NAME.test(value) && !value.includes("..");
}

export function assertSafeName(kind: "id" | "collection", value: unknown): asserts value is string {
  if (!isSafeName(value)) throw new Error(`Invalid ${kind}: ${JSON.stringify(value)}`);
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

export interface FileRead<T> {
  doc: T;
  mtimeMs: number;
}

/** Stat before read: a concurrent rewrite then shows up as a newer mtime, never an older one */
export async function readDocFile<T>(file: string): Promise<FileRead<T> | null> {
  try {
    const { mtimeMs } = await fs.stat(file);
    const doc = JSON.parse(await fs.readFile(file, "utf-8")) as T;
    return { doc, mtimeMs };
  } catch (err) {
    if (isNotFound(err)) return null;
    if (err instanceof SyntaxError) {
      console.error(`[storage] skipping corrupt file ${file}:`, err.message);
      return null;
    }
    throw err;
  }
}

export async function fileMtime(file: string): Promise<number | null> {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function readRawFile(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Write to a temp file and rename over the target, so readers never see a torn file */
export async function writeFileAtomic(file: string, content: string): Promise<number> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o755 });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, content, { mode: 0o644 });
  try {
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
  return (await fs.stat(file)).mtimeMs;
}

export function serializeDoc(doc: unknown): string {
  return JSON.stringify(doc, null, 2);
}

export async function removeFile(file: string): Promise<boolean> {
  try {
    await fs.unlink(file);
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

export async function listDocIds(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .filter(isSafeName)
      .sort();
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}
