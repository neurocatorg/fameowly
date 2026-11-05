import crypto from "crypto";

const SCRYPT_KEYLEN = 32;

export const MIN_PASSWORD_LENGTH = 6;

// Verified against when the account is unknown or has no password, so timing does not tell them apart
const DUMMY_HASH = hashPassword("timing-equalizer");

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

/** True for pre-salt hashes that should be upgraded on next successful login */
export function isLegacyHash(stored: string): boolean {
  return !stored.includes(":");
}

export function verifyPassword(plain: string, stored: string | undefined): boolean {
  if (!stored) {
    verifyPassword(plain, DUMMY_HASH);
    return false;
  }
  if (isLegacyHash(stored)) {
    const legacy = crypto.createHash("sha256").update(plain).digest("hex");
    return timingSafeEqualHex(legacy, stored);
  }

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex");
  return timingSafeEqualHex(candidate, hash);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
