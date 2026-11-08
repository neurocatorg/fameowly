import { connection } from "next/server";
import { BrandLogo } from "@/components/public/brand-logo";
import { PublicFooter } from "@/components/public/public-footer";
import { container, initializeContainer } from "@/lib/plugin-loader";
import { normalizeEmail } from "@/lib/sign-in/email";
import { LoginFlow } from "./_components/login-flow";

// A same-site path only: "//host", backslashes and whitespace (browsers drop tabs) could leave the site
const SAFE_NEXT = /^\/(?![/\\])[^\s\\]*$/;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  initializeContainer();
  const emailLogin = container.get("mailer").isConfigured();
  // Links in mail may name the address, e.g. /login?email=a@b.c
  const params = await searchParams;
  const initialEmail = normalizeEmail(params.email) ?? "";
  // Where to go after sign-in, e.g. /login?next=/info/topup
  const next = typeof params.next === "string" && SAFE_NEXT.test(params.next) ? params.next : "/";

  return (
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-th-page via-th-panel to-th-page">
      <div className="flex min-h-full flex-col items-center justify-center px-4 pt-8">
        <div className="w-full max-w-sm rounded-2xl border border-th-border bg-th-panel/80 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex justify-center">
            <BrandLogo />
          </div>

          <LoginFlow emailLogin={emailLogin} initialEmail={initialEmail} next={next} />
        </div>

        <div className="w-full max-w-4xl">
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}
