"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { collections } from "@/lib/firebase/collections";
import { getDb } from "@/lib/firebase/client";
import { useI18n } from "@/lib/i18n/locale";
import { termsBlocks } from "@/lib/settings/terms-blocks";

/**
 * The terms and conditions a buyer must accept before the payment gateway opens.
 *
 * Reads the text the panel writes in Settings > General, so what a student agrees
 * to is exactly what an admin typed — falling back to the legacy `settings`
 * document the old admin wrote, the way the profile page does.
 */
export function TermsDialog({
  open,
  onOpenChange,
  onAgree,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}) {
  const { t, locale } = useI18n();
  const terms = useQuery({
    queryKey: ["terms", locale],
    queryFn: async () => {
      const config = await getDoc(doc(getDb(), collections.adminConfig, "studentApp"));
      const localized = config.get("termsConditions") as { en?: string; ar?: string } | undefined;
      if (localized?.[locale]) return localized[locale];
      if (localized?.en) return localized.en;
      const settings = await getDocs(collection(getDb(), collections.settings));
      const main = settings.docs.find((d) => d.get("type") === "Main");
      return String(main?.get("termsConditions") || "");
    },
  });
  const blocks = terms.data ? termsBlocks(terms.data) : [];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("terms")}
      description={t("checkoutTermsHint")}
      className="md:max-w-2xl"
      footer={
        /* Two equal columns rather than a flex row: a `block` button is
           `w-full` and `shrink-0`, so a flex row of two of them demanded 200%
           of the dialog and spilled past its edge. */
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" block onClick={() => onOpenChange(false)}>
            {t("decline")}
          </Button>
          <Button
            block
            onClick={() => {
              onAgree();
              onOpenChange(false);
            }}
          >
            {t("iAgree")}
          </Button>
        </div>
      }
    >
      {terms.isPending ? (
        <div className="grid place-items-center py-8">
          <Loader size="inline" />
        </div>
      ) : blocks.length ? (
        <div className="flex flex-col gap-5">
          {blocks.map((block, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {block.title ? <p className="text-[12px] text-muted">{block.title}</p> : null}
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{block.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-[13px] text-muted">{t("termsUnavailable")}</p>
      )}
    </Sheet>
  );
}
