import { hashPassword, isLegacyHash, verifyPassword } from "../password";
import { findUserByEmail, findUserByName, updateUser, type User } from "../user-store";
import { normalizeEmail } from "./email";
import { consumeLimit, isLimited } from "./rate-limit";
import * as L from "./limits";

export type PasswordSignInResult = { user: User } | { error: "invalid" | "limited" };

/** `login` is an email or a display name; failures are rate limited per login and per IP */
export async function signInWithPassword(
  login: string,
  password: string,
  ip: string | null,
): Promise<PasswordSignInResult> {
  const key = login.trim().toLowerCase();
  const limited =
    (await isLimited("pw-fail-login", key, L.HOUR_SECONDS, L.PASSWORD_FAILURES_PER_LOGIN_PER_HOUR)) ||
    (ip !== null &&
      (await isLimited("pw-fail-ip", ip, L.HOUR_SECONDS, L.PASSWORD_FAILURES_PER_IP_PER_HOUR)));
  if (limited) return { error: "limited" };

  const email = normalizeEmail(login);
  const user =
    (email ? await findUserByEmail(email) : undefined) ?? (await findUserByName(login.trim()));

  // Always verify, so an unknown login takes as long as a wrong password
  const valid = verifyPassword(password, user?.password);
  if (!user || !valid) {
    await consumeLimit("pw-fail-login", key, L.HOUR_SECONDS, L.PASSWORD_FAILURES_PER_LOGIN_PER_HOUR);
    if (ip) await consumeLimit("pw-fail-ip", ip, L.HOUR_SECONDS, L.PASSWORD_FAILURES_PER_IP_PER_HOUR);
    return { error: "invalid" };
  }

  // Upgrade pre-salt hashes now that we have the plaintext
  if (user.password && isLegacyHash(user.password)) {
    user.password = hashPassword(password);
    user.sessionVersion = user.sessionVersion ?? 1;
    await updateUser(user.id, { password: user.password, sessionVersion: user.sessionVersion });
  }
  return { user };
}
