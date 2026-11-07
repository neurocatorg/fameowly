/**
 * Sign-in by a one-time email code: requesting a code, signing in with it and
 * resetting the password with it. Mail delivery is left to the caller, after
 * the response, so reply timing does not depend on whether an account exists.
 */

import crypto from "crypto";
import type { MailMessage } from "../contracts";
import { container, initializeContainer } from "../plugin-loader";
import { DuplicateKeyError } from "../storage/errors";
import {
  createUser,
  findUserByEmail,
  setUserPassword,
  updateUser,
  type User,
} from "../user-store";
import { consumeCode, issueCode, type CodePurpose } from "./auth-codes";
import { codeMessage } from "./mail-templates";
import { claimCooldown, consumeLimit, isLimited } from "./rate-limit";
import * as L from "./limits";

export type StartResult =
  | { status: "code"; resendIn: number; noAccountHint: boolean; mail?: MailMessage }
  | { status: "request-access" }
  | { status: "cooldown"; retryAfter: number }
  | { status: "limited" }
  | { status: "unavailable" };

export type VerifyResult = { user: User } | { error: "invalid" | "limited" };

type SendRefusal = Extract<StartResult, { status: "cooldown" | "limited" }>;

/** Limits apply to every address, so a 429 says nothing about an account */
export async function claimSendLimits(email: string, ip: string | null): Promise<SendRefusal | null> {
  const retryAfter = await claimCooldown("send", email, L.RESEND_COOLDOWN_SECONDS);
  if (retryAfter > 0) return { status: "cooldown", retryAfter };
  if (!(await consumeLimit("send-email", email, L.HOUR_SECONDS, L.SENDS_PER_EMAIL_PER_HOUR))) {
    return { status: "limited" };
  }
  if (ip && !(await consumeLimit("send-ip", ip, L.HOUR_SECONDS, L.SENDS_PER_IP_PER_HOUR))) {
    return { status: "limited" };
  }
  return null;
}

export async function startEmailCode(
  email: string,
  purpose: Extract<CodePurpose, "login" | "reset_password">,
  ip: string | null,
): Promise<StartResult> {
  initializeContainer();
  if (!container.get("mailer").isConfigured()) return { status: "unavailable" };

  const user = await findUserByEmail(email);
  const action = await container.get("registrationPolicy").resolveUnknownEmail(email);
  if (!user && purpose === "login" && action === "request-access") {
    return { status: "request-access" };
  }

  const refusal = await claimSendLimits(email, ip);
  if (refusal) return refusal;

  const reply = {
    status: "code" as const,
    resendIn: L.RESEND_COOLDOWN_SECONDS,
    noAccountHint: action === "closed",
  };
  const sendsCode = Boolean(user) || (purpose === "login" && action === "send-code");
  if (!sendsCode) return reply;

  const code = await issueCode(purpose, email);
  return { ...reply, mail: codeMessage(purpose, email, code) };
}

export async function checkCode(purpose: CodePurpose, email: string, code: string, ip: string | null) {
  if (ip && (await isLimited("code-fail-ip", ip, L.HOUR_SECONDS, L.CODE_FAILURES_PER_IP_PER_HOUR))) {
    return "limited" as const;
  }
  if (await consumeCode(purpose, email, code)) return "ok" as const;
  if (ip) await consumeLimit("code-fail-ip", ip, L.HOUR_SECONDS, L.CODE_FAILURES_PER_IP_PER_HOUR);
  return "invalid" as const;
}

async function markVerified(user: User): Promise<User> {
  if (user.emailVerifiedAt) return user;
  return (await updateUser(user.id, { emailVerifiedAt: new Date().toISOString() })) ?? user;
}

/** Only the registration policy may let a code create an account */
async function signUp(email: string): Promise<User | null> {
  initializeContainer();
  if (!(await container.get("registrationPolicy").canCreateUser(email))) return null;

  const user: User = {
    id: crypto.randomUUID(),
    name: email,
    email,
    emailVerifiedAt: new Date().toISOString(),
    role: "user",
    sessionVersion: 1,
  };
  try {
    await createUser(user);
  } catch (err) {
    // A parallel verification of the same address won the race
    if (err instanceof DuplicateKeyError) return (await findUserByEmail(email)) ?? null;
    throw err;
  }
  await container.get("userLifecycle").onUserCreated?.(
    { id: user.id, name: user.name, email, role: user.role },
    { source: "signup" },
  );
  return user;
}

export async function verifyLoginCode(email: string, code: string, ip: string | null): Promise<VerifyResult> {
  const check = await checkCode("login", email, code, ip);
  if (check !== "ok") return { error: check };

  const user = (await findUserByEmail(email)) ?? (await signUp(email));
  if (!user) return { error: "invalid" };
  return { user: await markVerified(user) };
}

export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string,
  ip: string | null,
): Promise<VerifyResult> {
  const check = await checkCode("reset_password", email, code, ip);
  if (check !== "ok") return { error: check };

  const user = await findUserByEmail(email);
  if (!user) return { error: "invalid" };
  await setUserPassword(user, newPassword);
  return { user: await markVerified(user) };
}
