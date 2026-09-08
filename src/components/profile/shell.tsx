"use client";

import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/auth/brand-logo";
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
      <div className="lg:grid lg:grid-cols-[365px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:pt-2">
        <aside className="hidden lg:sticky lg:top-[90px] lg:block lg:max-h-[calc(100dvh-110px)] lg:overflow-y-auto">
          <ProfileHub />
        </aside>
        <div className="min-w-0 w-full">
          {isHub ? (
            <>
              <div className="lg:hidden">
                <ProfileHub />
              </div>
              <div className="hidden min-h-[calc(100dvh-180px)] w-full items-center justify-center lg:flex">
                <BrandLogo className="opacity-20" />
              </div>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </AppShell>
  );
}
