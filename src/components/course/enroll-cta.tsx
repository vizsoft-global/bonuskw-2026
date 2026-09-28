"use client";

import { EmiInfo } from "@/components/course/emi-info";
import { HomeIcon } from "@/components/home/icon";
import { useI18n } from "@/lib/i18n/locale";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/ui/haptics";

export type EnrollStat = { icon: string; text: string };

export function EnrollCta({
  chapters,
  lessons,
  duration,
  chaptersLabel,
  lessonsLabel,
  stats: statsProp,
  price,
  enrollLabel,
  emiPlan,
  secure,
  block,
  busy,
  showEmi = true,
  onEnroll,
  onEmi,
}: {
  chapters?: number;
  lessons?: number;
  /** Preformatted runtime ("2 Hrs" / "14 Min"); omitted when there is none. */
  duration?: string;
  chaptersLabel?: string;
  lessonsLabel?: string;
  stats?: EnrollStat[];
  price: string;
  enrollLabel: string;
  /** Installment amounts; the button shows only the count, the icon the breakup. */
  emiPlan?: number[];
  secure: string;
  block?: string;
  busy?: boolean;
  showEmi?: boolean;
  onEnroll: () => void;
  onEmi?: () => void;
}) {
  const stats =
    statsProp ??
    [
      chaptersLabel ? { icon: "/course/book.svg", text: `${chapters ?? 0} ${chaptersLabel}` } : null,
      lessonsLabel ? { icon: "/course/lessons.svg", text: `${lessons ?? 0} ${lessonsLabel}` } : null,
      duration ? { icon: "/course/clock.svg", text: duration } : null,
    ].filter(Boolean) as EnrollStat[];
  const { t } = useI18n();
  const disabled = Boolean(block) || busy;
  const installments = (emiPlan ?? []).filter((amount) => Number(amount) > 0);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-3">
        {stats.length ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {stats.map((stat) => (
              <div key={stat.text} className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
                <span className="size-3.5 shrink-0">
                  <HomeIcon src={stat.icon} />
                </span>
                <span className="truncate">{stat.text}</span>
              </div>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            haptic("medium");
            onEnroll();
          }}
          className={cn(
            "relative flex h-12 w-full items-center justify-between rounded-full px-4",
            block ? "cursor-not-allowed bg-surface-2" : "bg-[#0c5eff] disabled:opacity-70",
          )}
        >
          {busy ? (
            <span className="absolute inset-0 grid place-items-center">
              <Loader size="inline" />
            </span>
          ) : (
            <>
              <span className={cn("text-[14px] font-semibold", block ? "text-muted" : "text-white")}>
                {price}
              </span>
              <span className={cn("flex items-center gap-2 text-[14px] font-semibold", block ? "text-muted" : "text-white")}>
                {block || enrollLabel}
                {block ? null : (
                  <span className="size-3.5 -scale-x-100 rtl:scale-x-100">
                    <HomeIcon src="/course/enroll-arrow.svg" />
                  </span>
                )}
              </span>
            </>
          )}
        </button>
        {showEmi && !block && installments.length > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onEmi}
              className="relative flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-[#ff7a00] px-4 text-[14px] font-semibold text-text disabled:opacity-70"
            >
              {busy ? <Loader size="inline" /> : t("emiPayCount", { n: installments.length })}
            </button>
            <EmiInfo plan={installments} />
          </div>
        ) : null}
      </div>
      <p className="text-center text-[11px] text-muted">{secure}</p>
    </div>
  );
}
