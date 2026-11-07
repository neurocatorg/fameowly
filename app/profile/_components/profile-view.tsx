"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import { PluginSlot } from "@/lib/plugin-ui";
import { useProfile } from "@/hooks/use-profile";
import { NameSection } from "./name-section";
import { EmailSection } from "./email-section";
import { PasswordSection } from "./password-section";

/** Own account: name, email, password; plugins add the balance and its history */
export function ProfileView() {
  const { user, reload } = useProfile();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-th-page text-th-fg safe-area-top">
      <header className="flex items-center gap-3 border-b border-th-border px-3 py-3 md:gap-4 md:px-6 md:py-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-th-fg-s transition hover:bg-th-panel hover:text-th-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <UserRound className="h-5 w-5 text-th-accent" />
          Профиль
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-3 py-6 md:px-6 md:py-8">
          {!user ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-th-accent" />
            </div>
          ) : (
            <>
              <PluginSlot id="profile-balance" />
              <NameSection name={user.name} onSaved={reload} />
              <EmailSection email={user.email} verified={Boolean(user.emailVerified)} onSaved={reload} />
              <PasswordSection hasPassword={Boolean(user.hasPassword)} email={user.email} onSaved={reload} />
              <PluginSlot id="profile-payments" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
