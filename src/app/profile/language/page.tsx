"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useI18n } from "@/lib/i18n/locale";

export default function LanguagePage() {
  const { t, locale, setLocale } = useI18n();
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("language")}</h1>
      <div className="flex gap-3">
        <button type="button" onClick={() => setLocale("en")} className={locale === "en" ? "text-primary" : ""}>English</button>
        <button type="button" onClick={() => setLocale("ar")} className={locale === "ar" ? "text-primary" : ""}>العربية</button>
      </div>
    </AppShell>
  );
}
