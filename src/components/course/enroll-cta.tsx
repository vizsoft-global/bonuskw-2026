"use client";

import { HomeIcon } from "@/components/home/icon";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/ui/haptics";

export type EnrollStat = { icon: string; text: string };

export function EnrollCta({
  chapters,
  lessons,
  hours,
  chaptersLabel,
  lessonsLabel,
  hoursLabel,
  stats: statsProp,
  price,
  enrollLabel,
  emiPrice,
  emiLabel,
  secure,
  block,
  busy,
  showEmi = true,
  onEnroll,
  onEmi,
}: {
  chapters?: number;
  lessons?: number;
  hours?: number;
  chaptersLabel?: string;
  lessonsLabel?: string;
  hoursLabel?: string;
  stats?: EnrollStat[];
  price: string;
  enrollLabel: string;
  emiPrice?: string;
  emiLabel?: string;
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
      hoursLabel ? { icon: "/course/clock.svg", text: `${hours ?? 0} ${hoursLabel}` } : null,
    ].filter(Boolean) as EnrollStat[];
  const disabled = Boolean(block) || busy;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-[#141414] p-3">
        {stats.length ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {stats.map((stat) => (
              <div key={stat.text} className="flex min-w-0 items-center gap-1.5 text-[12px] text-[#999]">
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
            block ? "cursor-not-allowed bg-[#2a2a2a]" : "bg-[#0c5eff] disabled:opacity-70",
          )}
        >
          {busy ? (
            <span className="absolute inset-0 grid place-items-center">
              <Loader size="inline" />
            </span>
          ) : (
            <>
              <span className={cn("text-[14px] font-semibold", block ? "text-[#999]" : "text-white")}>
                {price}
              </span>
              <span className={cn("flex items-center gap-2 text-[14px] font-semibold", block ? "text-[#999]" : "text-white")}>
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
        {showEmi && !block ? (
          <button
            type="button"
            disabled={busy}
            onClick={onEmi}
            className="relative flex h-12 w-full items-center justify-between rounded-full bg-[#ff7a00] px-4 disabled:opacity-70"
          >
            {busy ? (
              <span className="absolute inset-0 grid place-items-center">
                <Loader size="inline" />
              </span>
            ) : (
              <>
                <span className="text-[14px] font-semibold text-white">{emiPrice}</span>
                <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
                  {emiLabel}
                  <span className="size-3.5 -scale-x-100 rtl:scale-x-100">
                    <HomeIcon src="/course/enroll-arrow.svg" />
                  </span>
                </span>
              </>
            )}
          </button>
        ) : null}
      </div>
      <p className="text-center text-[11px] text-[#999]">{secure}</p>
    </div>
  );
}
