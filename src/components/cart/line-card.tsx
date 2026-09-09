"use client";

import { HomeIcon } from "@/components/home/icon";
import { hasThumb, ThumbPlaceholder } from "@/components/home/course-thumb";
import type { CartLine } from "@/lib/cart/store";
import { EMI_COUNT, splitEmi } from "@/lib/course/emi";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/ui/haptics";

function linePriceLabel(
  line: CartLine,
  locale: Locale,
  emiMonths: string,
  quoted?: number[],
) {
  const amount = Number(line.price) || 0;
  if (line.paymentType !== "EMI") return formatKwdLocale(amount, locale);
  // Server quote wins (it knows promotions/coupons); fall back to the course plan.
  const plan =
    quoted && quoted.length >= 2
      ? quoted
      : line.emiAmounts && line.emiAmounts.length >= 2
        ? line.emiAmounts
        : splitEmi(amount, "even", line.emiCount ?? EMI_COUNT);
  return emiMonths
    .replace("{amount}", formatKwdLocale(plan[0], locale))
    .replace("{n}", String(plan.length));
}

export function LineCard({
  line,
  locale,
  onPayType,
  onSaveLater,
  onRemove,
  labels,
  installments,
}: {
  line: CartLine;
  locale: Locale;
  /** Quoted installment amounts for this line when paying by EMI. */
  installments?: number[];
  onPayType: (type: "Full payment" | "EMI") => void;
  onSaveLater: () => void;
  onRemove: () => void;
  labels: { fullPay: string; emi: string; emiMonths: string; saveLater: string; remove: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 overflow-hidden rounded-[12px] p-1">
        <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[8px] border-[0.5px] border-white/15 bg-[#1d1d1d] lg:h-[90px] lg:w-[160px]">
          {hasThumb(line.image) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={line.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <ThumbPlaceholder />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <p className="line-clamp-2 px-1 text-[14px] font-medium leading-normal text-[#fafafa]">
            {line.title || line.courseId}
          </p>
          <div className="flex items-end justify-between gap-2 px-1 pb-0.5">
            {line.batch ? (
              <span className="rounded-[6px] border-[0.5px] border-white bg-[#545454] px-1.5 py-[3px] text-[12px] font-medium text-white">
                {line.batch}
              </span>
            ) : (
              <span />
            )}
            <p className="max-w-[58%] shrink-0 text-end text-[13px] font-semibold leading-tight text-[#fafafa]">
              {linePriceLabel(line, locale, labels.emiMonths, installments)}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {line.kind === "course" && line.emiAvailable !== false ? (
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => onPayType("Full payment")}
              className={cn(
                "min-h-11 px-1",
                line.paymentType === "Full payment" ? "font-medium text-[#fafafa]" : "text-[#999]",
              )}
            >
              {labels.fullPay}
            </button>
            <button
              type="button"
              onClick={() => onPayType("EMI")}
              className={cn(
                "min-h-11 px-1",
                line.paymentType === "EMI" ? "font-medium text-[#fafafa]" : "text-[#999]",
              )}
            >
              {labels.emi}
            </button>
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-3 text-[11px]">
          <button type="button" onClick={onSaveLater} className="min-h-11 text-[#999]">
            {labels.saveLater}
          </button>
          <button type="button" onClick={onRemove} className="min-h-11 text-[#f24822]">
            {labels.remove}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PayCta({
  amount,
  label,
  disabled,
  onPay,
}: {
  amount: string;
  label: string;
  disabled?: boolean;
  onPay: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic("medium");
        onPay();
      }}
      className="relative flex h-[49px] w-full items-center justify-between rounded-[24px] border-[0.5px] border-white/40 bg-[#0c5eff] px-5 disabled:opacity-50"
    >
      <span className="text-[14px] text-white">{amount}</span>
      <span className="flex items-center gap-2.5 text-[16px] font-semibold text-white">
        {label}
        <span className="size-[18px] -scale-x-100 rtl:scale-x-100">
          <HomeIcon src="/course/enroll-arrow.svg" />
        </span>
      </span>
    </button>
  );
}

export function SavedCard({
  line,
  locale,
  onMove,
  moveLabel,
}: {
  line: CartLine;
  locale: Locale;
  onMove: () => void;
  moveLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-[#141414] p-2">
      <div className="relative aspect-[16/9] overflow-hidden rounded-[8px] bg-[#1d1d1d]">
        {hasThumb(line.image) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <ThumbPlaceholder />
        )}
      </div>
      <p className="line-clamp-2 min-h-[36px] text-[14px] font-medium leading-5 text-[#fafafa]">
        {line.title || line.courseId}
      </p>
      <p className="text-[13px] font-semibold text-[#fafafa]">{formatKwdLocale(line.price, locale)}</p>
      <button
        type="button"
        onClick={onMove}
        className="h-8 w-full rounded-full bg-[#0c5eff] text-[11px] font-medium text-white"
      >
        {moveLabel}
      </button>
    </div>
  );
}
