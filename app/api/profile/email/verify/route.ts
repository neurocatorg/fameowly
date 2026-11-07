import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { normalizeCode } from "@/lib/sign-in/auth-codes";
import { clientIp } from "@/lib/sign-in/client-ip";
import { normalizeEmail } from "@/lib/sign-in/email";
import { confirmEmailChange } from "@/lib/sign-in/email-change";
import { readBody, signInError } from "@/lib/sign-in/http";

/** POST /api/profile/email/verify { email, code } — bind the confirmed address to the account */
export async function POST(request: NextRequest) {
  const user = await authorize(request.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  if (!email) return signInError("email");
  const code = normalizeCode(body.code);
  if (!code) return signInError("code");

  const result = await confirmEmailChange(user, email, code, clientIp(request.headers));
  if ("user" in result) return NextResponse.json({ email: result.user.email });
  if (result.error === "taken") {
    return NextResponse.json({ error: "Этот адрес привязан к другому аккаунту" }, { status: 409 });
  }
  return signInError(result.error === "limited" ? "limited" : "code");
}
