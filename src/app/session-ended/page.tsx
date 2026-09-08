"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/locale";

export default function SessionEndedPage() {
  const { t } = useI18n();
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">{t("sessionEnded")}</h1>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
          {t("signInAgain")}
        </Link>
      </div>
    </main>
  );
}
