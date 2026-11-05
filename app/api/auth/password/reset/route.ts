import { NextRequest, NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { clientIp } from "@/lib/sign-in/client-ip";
import { normalizeEmail } from "@/lib/sign-in/email";
import { normalizeCode } from "@/lib/sign-in/auth-codes";
import { resetPasswordWithCode } from "@/lib/sign-in/email-code-flow";
import { readBody, signInError, signedIn } from "@/lib/sign-in/http";

/** POST /api/auth/password/reset { email, code, newPassword } — signs out other devices */
export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  if (!email) return signInError("email");
  const code = normalizeCode(body.code);
  if (!code) return signInError("code");
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Минимальная длина пароля — ${MIN_PASSWORD_LENGTH} символов` },
      { status: 400 },
    );
  }

  const result = await resetPasswordWithCode(email, code, newPassword, clientIp(request.headers));
  if ("error" in result) return signInError(result.error === "limited" ? "limited" : "code");
  return signedIn(result.user);
}
