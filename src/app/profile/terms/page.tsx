"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { ProfilePane } from "@/components/profile/pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

function blocksFrom(text: string) {
  const chunks = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return chunks.map((chunk) => {
    const nl = chunk.indexOf("\n");
    if (nl > 0 && nl < 80) return { title: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1).trim() };
    return { title: "", body: chunk };
  });
}

export default function TermsPage() {
  const { t, locale } = useI18n();
  const terms = useQuery({
    queryKey: ["terms", locale],
    queryFn: async () => {
      const config = await getDoc(doc(getDb(), collections.adminConfig, "studentApp"));
      const localized = config.get("termsConditions") as { en?: string; ar?: string } | undefined;
      if (localized?.[locale]) return localized[locale];
      const settings = await getDocs(collection(getDb(), collections.settings));
      const main = settings.docs.find((d) => d.get("type") === "Main");
      return String(main?.get("termsConditions") || "");
    },
  });
  const text = terms.data || "";
  const blocks = text ? blocksFrom(text) : [];

  return (
    <ProfilePane loading={terms.isPending} title={t("terms")} skeleton={<ListPageSkeleton rows={3} />}>
      {blocks.length ? (
        <div className="flex flex-col gap-7">
          {blocks.map((block, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              {block.title ? <p className="text-[12px] text-[#999]">{block.title}</p> : null}
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#fafafa]">{block.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="/profile/file.svg" title={t("emptyTermsTitle")} body={t("emptyTermsBody")} />
      )}
    </ProfilePane>
  );
}
