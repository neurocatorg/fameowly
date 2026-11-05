import { NextRequest, NextResponse, after } from "next/server";
import { container, initializeContainer } from "@/lib/plugin-loader";
import { clientIp } from "@/lib/sign-in/client-ip";
import { normalizeEmail } from "@/lib/sign-in/email";
import { startEmailCode } from "@/lib/sign-in/email-code-flow";
import { readBody, signInError } from "@/lib/sign-in/http";

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
      return NextResponse.json(
        { error: `Отправить код снова можно через ${result.retryAfter} с`, retryAfter: result.retryAfter },
        { status: 429 },
      );
    case "request-access":
      return NextResponse.json({ next: "request-access" });
  }

  const { mail } = result;
  if (mail) {
    initializeContainer();
    const mailer = container.get("mailer");
    after(() =>
      mailer.send(mail).catch((err: unknown) => {
        console.error("[mail] send failed:", err instanceof Error ? err.message : err);
      }),
    );
  }
  return NextResponse.json({
    next: "code",
    resendIn: result.resendIn,
    noAccountHint: result.noAccountHint,
  });
}
