import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { clientIp } from "@/lib/sign-in/client-ip";
import { normalizeEmail } from "@/lib/sign-in/email";
import { startEmailChange } from "@/lib/sign-in/email-change";
import { cooldownError, mailAfterResponse, readBody, signInError } from "@/lib/sign-in/http";

/** POST /api/profile/email/start { email } — send a confirmation code to the new address */
export async function POST(request: NextRequest) {
  const user = await authorize(request.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const email = normalizeEmail((await readBody(request)).email);
  if (!email) return signInError("email");

  const result = await startEmailChange(user, email, clientIp(request.headers));
  switch (result.status) {
    case "unavailable":
      return NextResponse.json({ error: "Почта не настроена" }, { status: 503 });
    case "limited":
      return signInError("limited");
    case "cooldown":
      return cooldownError(result.retryAfter);
    case "same":
      return NextResponse.json({ error: "Этот адрес уже подтверждён" }, { status: 400 });
  }

  mailAfterResponse(result.mail);
  return NextResponse.json({ resendIn: result.resendIn });
}
