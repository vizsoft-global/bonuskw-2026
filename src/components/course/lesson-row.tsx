"use client";

import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";

export function LessonRow({
  name,
  image,
  duration,
  locked,
}: {
  name: string;
  image?: string;
  duration?: number;
  locked: boolean;
}) {
  const mins = duration && Number.isFinite(duration) ? Math.max(1, Math.round(duration / 60)) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[82/55] overflow-hidden rounded-[10px] border-[0.5px] border-white/25 bg-[#252525]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : null}
        <span className={cn("absolute inset-0 grid place-items-center", locked ? "bg-black/45" : "bg-black/20")}>
          {locked ? (
            <span className="size-5">
              <HomeIcon src="/course/lock.svg" />
            </span>
          ) : (
            <span className="size-[18px]">
              <HomeIcon src="/course/play.svg" />
            </span>
          )}
        </span>
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-normal text-[#fafafa]">{name}</p>
      <span className="flex items-center gap-[5px] text-[11px] font-medium text-[#999]">
        <span className="size-3 shrink-0">
          <HomeIcon src="/course/clock.svg" />
        </span>
        {mins} min
      </span>
    </div>
  );
}
