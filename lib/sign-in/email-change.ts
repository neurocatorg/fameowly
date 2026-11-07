/**
 * Binding or changing the email of a signed-in account: a `verify_email` code
 * goes to the new address and is bound to the account that asked for it.
 */

import type { MailMessage } from "../contracts";
import { container, initializeContainer } from "../plugin-loader";
import { DuplicateKeyError } from "../storage/errors";
import { findUserByEmail, updateUser, type User } from "../user-store";
import { issueCode } from "./auth-codes";
import { checkCode, claimSendLimits, type StartResult } from "./email-code-flow";
import { codeMessage } from "./mail-templates";
import { RESEND_COOLDOWN_SECONDS } from "./limits";

export type EmailChangeStart =
  | Extract<StartResult, { status: "cooldown" | "limited" | "unavailable" }>
  | { status: "same" }
  | { status: "code"; resendIn: number; mail: MailMessage };

export type EmailChangeResult = { user: User } | { error: "invalid" | "limited" | "taken" };

const codeKey = (user: User, email: string) => `${user.id} ${email}`;

export async function startEmailChange(user: User, email: string, ip: string | null): Promise<EmailChangeStart> {
  initializeContainer();
  if (!container.get("mailer").isConfigured()) return { status: "unavailable" };
  if (user.email === email && user.emailVerifiedAt) return { status: "same" };

  const refusal = await claimSendLimits(email, ip);
  if (refusal) return refusal;

  const code = await issueCode("verify_email", codeKey(user, email));
  return { status: "code", resendIn: RESEND_COOLDOWN_SECONDS, mail: codeMessage("verify_email", email, code) };
}

/** "taken" only after a correct code, so it cannot probe other people's addresses */
export async function confirmEmailChange(
  user: User,
  email: string,
  code: string,
  ip: string | null,
): Promise<EmailChangeResult> {
  const check = await checkCode("verify_email", codeKey(user, email), code, ip);
  if (check !== "ok") return { error: check };

  const owner = await findUserByEmail(email);
  if (owner && owner.id !== user.id) return { error: "taken" };
  try {
    const updated = await updateUser(user.id, { email, emailVerifiedAt: new Date().toISOString() });
    return updated ? { user: updated } : { error: "invalid" };
  } catch (err) {
    if (err instanceof DuplicateKeyError) return { error: "taken" };
    throw err;
  }
}
