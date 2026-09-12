"use client";

import { HomeIcon } from "@/components/home/icon";
import { haptic } from "@/lib/ui/haptics";

type Stat = { icon: string; text: string };

function Stats({ stats }: { stats: Stat[] }) {
  if (!stats.length) return null;
  return (
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
  );
}

/** Replaces the Enroll card once the student owns the course. */
export function EnrolledCta({
  chapters,
  lessons,
  hours,
  chaptersLabel,
  lessonsLabel,
  hoursLabel,
  title,
  label,
  onContinue,
}: {
  chapters?: number;
  lessons?: number;
  hours?: number;
  chaptersLabel?: string;
  lessonsLabel?: string;
  hoursLabel?: string;
  title: string;
  label: string;
  onContinue: () => void;
}) {
  const stats = [
    chaptersLabel ? { icon: "/course/book.svg", text: `${chapters ?? 0} ${chaptersLabel}` } : null,
    lessonsLabel ? { icon: "/course/lessons.svg", text: `${lessons ?? 0} ${lessonsLabel}` } : null,
    hoursLabel ? { icon: "/course/clock.svg", text: `${hours ?? 0} ${hoursLabel}` } : null,
  ].filter(Boolean) as Stat[];

  return (
    <div className="mt-5 flex flex-col gap-2.5">
      <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-4">
        <Stats stats={stats} />
        <button
          type="button"
          onClick={() => {
            haptic("medium");
            onContinue();
          }}
          className="relative flex h-12 w-full items-center justify-between rounded-full bg-[#1f9d4d] px-4 text-white"
        >
          <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[12px]">✓</span>
            {title}
          </span>
          <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
            {label}
            <span className="size-3.5 -scale-x-100 rtl:scale-x-100">
              <HomeIcon src="/course/enroll-arrow.svg" />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

/** Instructors and admins browse the student app but cannot buy. */
export function StaffViewOnlyNotice({
  title,
  body,
  price,
}: {
  title: string;
  body: string;
  price?: string;
}) {
  return (
    <div className="mt-5 flex flex-col gap-2 rounded-[24px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold text-text">{title}</p>
        {price ? <span className="text-[14px] font-semibold text-muted">{price}</span> : null}
      </div>
      <p className="text-[12px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
