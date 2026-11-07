import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/sign-in/client-ip";
import { normalizeEmail } from "@/lib/sign-in/email";
import { startEmailCode } from "@/lib/sign-in/email-code-flow";
import { cooldownError, mailAfterResponse, readBody, signInError } from "@/lib/sign-in/http";

/** POST /api/auth/email/start { email, purpose? } — send a login or password reset code */
export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  if (!email) return signInError("email");
  const purpose = body.purpose === "reset_password" ? "reset_password" : "login";

  const result = await startEmailCode(email, purpose, clientIp(request.headers));
  switch (result.status) {
    case "unavailable":
      return signInError("unavailable");
    case "limited":
      return signInError("limited");
    case "cooldown":
      return cooldownError(result.retryAfter);
    case "request-access":
      return NextResponse.json({ next: "request-access" });
  }

  if (result.mail) mailAfterResponse(result.mail);
  return NextResponse.json({
    next: "code",
    resendIn: result.resendIn,
    noAccountHint: result.noAccountHint,
  });
}
