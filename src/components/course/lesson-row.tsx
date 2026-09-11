"use client";

import { HomeIcon } from "@/components/home/icon";
import { BrandThumb } from "@/components/shared/brand-thumb";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export function LessonRow({
  name,
  image,
  seed,
  duration,
  locked,
}: {
  name: string;
  image?: string;
  /** Chapter id: colour of the default artwork when the lesson has no image. */
  seed?: string;
  duration?: number;
  locked: boolean;
}) {
  const { t } = useI18n();
  const mins = duration && Number.isFinite(duration) ? Math.max(1, Math.round(duration / 60)) : 0;
  const thumb = image;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[82/55] overflow-hidden rounded-[10px] border-[0.5px] border-white/25 bg-[#252525]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <BrandThumb seed={seed} />
        )}
        <span className={cn("absolute inset-0", locked ? "bg-black/45" : "bg-black/20")} />
        {locked ? (
          <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/65 ring-1 ring-white/25">
            <span className="size-3">
              <HomeIcon src="/course/lock.svg" />
            </span>
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <span className="size-[18px]">
              <HomeIcon src="/course/play.svg" />
            </span>
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-normal text-[#fafafa]">{name}</p>
      <span className="flex items-center gap-[5px] text-[11px] font-medium text-[#999]">
        <span className="size-3 shrink-0">
          <HomeIcon src="/course/clock.svg" />
        </span>
        {mins} {t("minShort")}
      </span>
    </div>
  );
}
