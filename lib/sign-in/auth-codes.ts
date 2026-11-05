/**
 * One-time email codes. Only an HMAC of the code is stored; one live code per
 * address and purpose, a new one replaces the previous.
 */

import crypto from "crypto";
import { getDocumentStore } from "../storage/db";
import { hashKey } from "./email";
import { CODE_DIGITS, CODE_MAX_ATTEMPTS, CODE_TTL_SECONDS } from "./limits";

export type CodePurpose = "login" | "reset_password" | "verify_email";

interface AuthCodeDoc {
  id: string;
  codeHash: string;
  attempts: number;
  createdAt: string;
}

function codes() {
  return getDocumentStore().collection<AuthCodeDoc>("auth_codes", {
    indexes: [{ fields: ["createdAt"], ttlSeconds: CODE_TTL_SECONDS }],
  });
}

function codeId(purpose: CodePurpose, email: string): string {
  return `${purpose}-${hashKey(email)}`;
}

function digest(id: string, code: string): Buffer {
  const secret =
    process.env.AUTH_CODE_SECRET ||
    process.env.JWT_SECRET ||
    "fallback-secret-change-me-please-32chars";
  return crypto.createHmac("sha256", secret).update(`auth-code:${id}:${code}`).digest();
}

/** "12345678" → "1234 5678" */
export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

/** Digits only, spaces and dashes allowed in the input */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${CODE_DIGITS}}$`).test(code) ? code : null;
}

export async function issueCode(purpose: CodePurpose, email: string): Promise<string> {
  const code = crypto.randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
  const id = codeId(purpose, email);
  await codes().upsert({
    id,
    codeHash: digest(id, code).toString("hex"),
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  return code;
}

/** True at most once per issued code; every guess counts toward the attempt limit */
export async function consumeCode(purpose: CodePurpose, email: string, code: string): Promise<boolean> {
  const id = codeId(purpose, email);
  const col = codes();

  // Count the attempt before comparing, so parallel guesses cannot exceed the limit
  const doc = await col.update(id, { inc: { attempts: 1 } });
  if (!doc) return false;

  const expired = Date.parse(doc.createdAt) + CODE_TTL_SECONDS * 1000 <= Date.now();
  if (expired || doc.attempts > CODE_MAX_ATTEMPTS) {
    await col.delete(id);
    return false;
  }

  if (!crypto.timingSafeEqual(Buffer.from(doc.codeHash, "hex"), digest(id, code))) {
    if (doc.attempts >= CODE_MAX_ATTEMPTS) await col.delete(id);
    return false;
  }

  // Whoever deletes the code owns it: a parallel request with the same code loses
  return col.delete(id);
}
