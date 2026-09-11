"use client";

import { usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

/** Shown only while this account is an unlocked tester. */
export function DevModeBanner({ className }: { className?: string }) {
  const { tester } = usePurchaseGate();
  const { t } = useI18n();
  if (!tester) return null;
  return (
    <p
      className={cn(
        "rounded-[10px] border border-[#f5d08a]/40 bg-[#f5d08a]/10 px-3 py-2 text-[12px] leading-relaxed text-[#f5d08a]",
        className,
      )}
    >
      {t("devModeBanner")}
    </p>
  );
}
