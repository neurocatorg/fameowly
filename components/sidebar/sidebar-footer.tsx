"use client";

import { useRouter } from "next/navigation";
import { Settings, LogOut, Github, BarChart2, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PluginSlot } from "@/lib/plugin-ui";
import { useUserInfo } from "@/hooks/use-user-info";
import { usePluginCapabilities } from "@/hooks/use-plugin-capabilities";
import { footerIconBtnCls, footerIconCls, footerRowCls } from "./footer-classes";

// ─── Types ─────────────────────────────────────────────────────────────────

interface FooterItem {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
}

interface SidebarFooterProps {
  /** Icon-only row instead of labelled rows — short viewports and open keyboards */
  compact?: boolean;
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function SidebarFooter({ compact, className }: SidebarFooterProps) {
  const router = useRouter();
  const user = useUserInfo();
  const { uiSlots } = usePluginCapabilities();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Item count varies by edition (usage-page slot) and role — both renderings share it
  const items: FooterItem[] = [
    { key: "profile", icon: UserRound, label: "Профиль", onClick: () => router.push("/profile") },
    ...(uiSlots.includes("usage-page")
      ? [{ key: "usage", icon: BarChart2, label: "Потребление", onClick: () => router.push("/usage") }]
      : []),
    ...(user?.role === "admin"
      ? [{ key: "admin", icon: Settings, label: "Админ-панель", onClick: () => router.push("/admin") }]
      : []),
    { key: "logout", icon: LogOut, label: "Выйти", onClick: handleLogout },
    { key: "github", icon: Github, label: "GitHub", href: "https://github.com/lemix/fameowly" },
  ];

  function renderItem({ key, icon: Icon, label, onClick, href }: FooterItem) {
    const icon = <Icon className={footerIconCls} strokeWidth={1.5} />;
    const common = {
      "data-testid": `footer-${key}`,
      className: compact ? footerIconBtnCls : footerRowCls,
      ...(compact ? { title: label, "aria-label": label } : {}),
    };
    return href ? (
      <a key={key} {...common} href={href} target="_blank" rel="noopener noreferrer">
        {icon}
        {!compact && label}
      </a>
    ) : (
      <button key={key} {...common} onClick={onClick}>
        {icon}
        {!compact && label}
      </button>
    );
  }

  // Plugin links (e.g. pricing) go right after the profile
  const entries = (
    <>
      {items.slice(0, 1).map(renderItem)}
      <PluginSlot id="sidebar-menu" props={{ compact: Boolean(compact) }} />
      {items.slice(1).map(renderItem)}
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-col border-t border-th-border pl-[26px] pr-5",
        compact ? "pt-3 pb-2" : "gap-[10px] pt-[29px] pb-[18px]",
        className,
      )}
      data-testid="sidebar-footer"
      data-compact={compact ? "true" : "false"}
    >
      {compact ? <div className="-ml-2 flex items-center gap-1">{entries}</div> : entries}

      <p className={cn("pl-1 text-sm leading-[17px] text-th-fg-f", compact ? "mt-2" : "mt-[14px]")}>
        © 2026 Fameowly
      </p>
    </div>
  );
}
