import crypto from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** Trimmed and lower-cased, or null when it does not look like an address */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
  return email;
}

/** Stable opaque key for document ids, so addresses never appear in them */
export function hashKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
