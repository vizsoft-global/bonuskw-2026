"use client";

import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { suggestionText, type Quote } from "@/lib/cart/quote";

/** Subtotal, the offer that applied, coupon, and what is due now. */
export function CartSummary({ quote, quoting, fallback }: { quote: Quote | null; quoting?: boolean; fallback: number }) {
  const { t, locale } = useI18n();
  const money = (value: number) => formatKwdLocale(value, locale as Locale);
  const lines = quote?.lines ?? [];
  const subtotal = lines.length ? lines.reduce((sum, line) => sum + (line.owned ? 0 : line.listPrice || 0), 0) : fallback;
  const offer = lines.reduce((sum, line) => sum + (line.owned ? 0 : line.promotionDiscount || 0), 0);
  const coupon = lines.reduce((sum, line) => sum + (line.owned ? 0 : line.couponDiscount || 0), 0);
  const due = quote?.dueNow ?? subtotal;
  const offerName = (quote?.promotions ?? [])
    .map((promo) => suggestionText(promo.name ?? null, locale))
    .filter(Boolean)
    .join(", ");
  const hints = Array.from(new Set((quote?.suggestions ?? []).map((item) => suggestionText(item.message, locale)))).filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      <Row label={t("subtotal")} value={money(subtotal)} />
      {offer > 0 ? (
        <Row label={offerName ? `${t("discountLabel")} · ${offerName}` : t("discountLabel")} value={`− ${money(offer)}`} accent />
      ) : null}
      {coupon > 0 ? <Row label={`${t("coupon")} · ${quote?.couponCode ?? ""}`} value={`− ${money(coupon)}`} accent /> : null}
      <div className="mt-1 flex items-center justify-between border-t border-line pt-2 text-[14px] font-semibold text-text">
        <span>{t("totalDueNow")}</span>
        <span>{quoting ? "…" : money(due)}</span>
      </div>
      {hints.map((hint) => (
        <p key={hint} className="text-[12px] text-[#0c5eff]">{hint}</p>
      ))}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "flex items-center justify-between gap-3 text-[#1f9d4d]" : "flex items-center justify-between gap-3 text-muted"}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}
