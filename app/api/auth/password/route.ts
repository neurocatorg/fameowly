import { NextRequest, NextResponse } from "next/server";
import {
  authorize,
  createSession,
  MIN_PASSWORD_LENGTH,
  setSessionCookie,
  setUserPassword,
  verifyPassword,
} from "@/lib/auth";
import { normalizeCode } from "@/lib/sign-in/auth-codes";
import { clientIp } from "@/lib/sign-in/client-ip";
import { checkCode } from "@/lib/sign-in/email-code-flow";
import { readBody, signInError } from "@/lib/sign-in/http";

/**
 * POST /api/auth/password { newPassword, currentPassword?, code? } — set your own password.
 * A first password needs nothing else; a change needs the current one or a `reset_password` code.
 */
export async function POST(request: NextRequest) {
  const user = await authorize(request.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await readBody(request);
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Минимальная длина пароля — ${MIN_PASSWORD_LENGTH} символов` },
      { status: 400 },
    );
  }

  if (user.password) {
    const code = normalizeCode(body.code);
    if (code && user.email) {
      const check = await checkCode("reset_password", user.email, code, clientIp(request.headers));
      if (check !== "ok") return signInError(check === "limited" ? "limited" : "code");
    } else if (typeof body.currentPassword !== "string" || !verifyPassword(body.currentPassword, user.password)) {
      return NextResponse.json({ error: "Текущий пароль неверен" }, { status: 403 });
    }
  }

  // Other devices are signed out; this one gets a fresh session
  await setUserPassword(user, newPassword);
  await setSessionCookie(await createSession(user));
  return NextResponse.json({ success: true });
}
