"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileHub } from "@/components/profile/hub";
import { useI18n } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/messages";

const titles: Record<string, MessageKey> = {
  "/profile": "profile",
  "/profile/personal": "personal",
  "/profile/saved": "savedCourses",
  "/profile/devices": "deviceLogs",
  "/profile/password": "changePassword",
  "/profile/transactions": "transactions",
  "/profile/terms": "terms",
  "/profile/language": "language",
  "/profile/notifications": "notifications",
};

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t } = useI18n();
  const isHub = path === "/profile";
  const titleKey = titles[path];

  return (
    <AppShell title={titleKey ? t(titleKey) : undefined}>
      {/*
        The hub is the icon grid and each sub-page is its own destination, so
        there is no persistent side menu: a sub-page owns the full width and the
        toolbar's back button (which already falls back to /profile) returns to
        the grid.
      */}
      {isHub ? <ProfileHub /> : <div className="mx-auto w-full max-w-[760px]">{children}</div>}
    </AppShell>
  );
}
