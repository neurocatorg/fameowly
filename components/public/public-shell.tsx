import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { authorize } from "@/lib/auth";
import { BrandLogo } from "./brand-logo";
import { PublicFooter } from "./public-footer";

/** Frame of every page open to guests: logo, sign-in (or back-to-app) link, content, legal footer */
export async function PublicShell({ children }: { children: ReactNode }) {
  const signedIn = Boolean(await authorize((await cookies()).get("session")?.value));
  return (
    <div className="h-[100dvh] overflow-y-auto bg-th-page text-th-fg">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 safe-area-top">
        <header className="flex items-center justify-between gap-4 py-5">
          <Link href="/" aria-label="На главную">
            <BrandLogo className="h-8" />
          </Link>
          <Link
            href={signedIn ? "/" : "/login"}
            className="rounded-lg bg-th-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-th-accent-muted"
          >
            {signedIn ? "Открыть FaMeowly" : "Войти"}
          </Link>
        </header>
        <main className="flex-1 py-6">{children}</main>
        <PublicFooter />
      </div>
    </div>
  );
}
