"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

const links = [
  ["/profile/personal", "personal"],
  ["/profile/saved", "saved"],
  ["/profile/devices", "deviceLogs"],
  ["/profile/password", "changePassword"],
  ["/profile/transactions", "transactions"],
  ["/profile/notifications", "notifications"],
  ["/profile/language", "language"],
  ["/profile/terms", "terms"],
] as const;

export default function ProfilePage() {
  const { profile, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <AppShell>
      <div className="glass max-w-lg rounded-3xl p-5">
        <h1 className="text-xl font-semibold">{profile?.display_name || t("profile")}</h1>
        <p className="text-sm text-muted">{profile?.phone_number}</p>
        <nav className="mt-6 divide-y divide-line">
          {links.map(([href, key]) => (
            <Link key={href} href={href} className="block py-3 text-sm">
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex gap-2 text-sm">
          <button type="button" onClick={() => setLocale("en")}>{locale === "en" ? "●" : "○"} English</button>
          <button type="button" onClick={() => setLocale("ar")}>{locale === "ar" ? "●" : "○"} العربية</button>
        </div>
        <div className="mt-3 flex gap-2 text-sm">
          {(["dark", "light", "system"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setTheme(item)} className={theme === item ? "text-primary" : ""}>
              {t(item)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void logout()} className="mt-6 text-sm text-accent">
          {t("logout")}
        </button>
      </div>
    </AppShell>
  );
}
