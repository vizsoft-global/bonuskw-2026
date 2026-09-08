"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function TermsPage() {
  const { t, locale } = useI18n();
  const terms = useQuery({
    queryKey: ["terms"],
    queryFn: async () => {
      const config = await getDoc(doc(getDb(), collections.adminConfig, "studentApp"));
      const localized = config.get("termsConditions") as { en?: string; ar?: string } | undefined;
      if (localized?.[locale]) return localized[locale];
      const settings = await getDocs(collection(getDb(), collections.settings));
      const main = settings.docs.find((d) => d.get("type") === "Main");
      return String(main?.get("termsConditions") || "");
    },
  });
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("terms")}</h1>
      <p className="whitespace-pre-wrap text-sm text-muted">{terms.data || t("empty")}</p>
    </AppShell>
  );
}
