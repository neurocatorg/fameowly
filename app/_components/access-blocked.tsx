"use client";

import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/public/brand-logo";
import { linkCls, noteCls } from "@/app/login/_components/styles";

/** Fallback for the `access-gate` slot: the plugin's reason and a way out */
export function AccessBlocked({ message }: { message: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-th-page px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-th-border bg-th-panel/80 p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <p className={noteCls}>{message}</p>
        <button type="button" onClick={() => void logout()} className={linkCls}>
          Выйти
        </button>
      </div>
    </div>
  );
}
