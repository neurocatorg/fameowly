import { NextRequest } from "next/server";
import { clientIp } from "@/lib/sign-in/client-ip";
import { normalizeEmail } from "@/lib/sign-in/email";
import { normalizeCode } from "@/lib/sign-in/auth-codes";
import { verifyLoginCode } from "@/lib/sign-in/email-code-flow";
import { readBody, signInError, signedIn } from "@/lib/sign-in/http";

/** POST /api/auth/email/verify { email, code } — sign in with an emailed code */
export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  if (!email) return signInError("email");
  const code = normalizeCode(body.code);
  if (!code) return signInError("code");

  const result = await verifyLoginCode(email, code, clientIp(request.headers));
  if ("error" in result) return signInError(result.error === "limited" ? "limited" : "code");
  return signedIn(result.user);
}
