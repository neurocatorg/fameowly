import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/public/brand-logo";
import { PublicFooter } from "@/components/public/public-footer";
import { container, initializeContainer } from "@/lib/plugin-loader";
import { HOME_PAGE_ID, getPublicPage } from "@/lib/plugins";
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
  // Without a landing, "/" sends a guest straight back here
  const hasHome = getPublicPage(HOME_PAGE_ID) !== null;
  const logo = <BrandLogo />;

  return (
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-th-page via-th-panel to-th-page">
      <div className="flex min-h-full flex-col items-center justify-center px-4 pt-8">
        {hasHome && (
          <div className="mb-4 w-full max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-th-fg-s transition hover:bg-th-panel hover:text-th-fg"
            >
              <ArrowLeft className="h-4 w-4" /> На главную
            </Link>
          </div>
        )}
        <div className="w-full max-w-sm rounded-2xl border border-th-border bg-th-panel/80 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex justify-center">
            {hasHome ? (
              <Link href="/" aria-label="На главную">
                {logo}
              </Link>
            ) : (
              logo
            )}
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
