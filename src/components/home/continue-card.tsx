import Link from "next/link";
import { CourseThumb } from "./course-thumb";
import { HomeIcon } from "./icon";

export type ContinueItem = {
  courseId: string;
  name: string;
  image?: string;
  pct: number;
  hrsLeft: number;
  /** Total minutes watched across the course's lessons. */
  watchedMin?: number;
  nextName?: string;
  lastStudied?: string;
  /** Epoch ms of the last watched lesson; drives Resume ordering. */
  lastStudiedAt?: number;
};

export function ContinueCard({
  item,
  labels,
}: {
  item: ContinueItem;
  labels: {
    percentCompleted: string;
    hrsLeft: string;
    watchedMin: string;
    nextLesson: string;
    lastStudied: string;
    resume: string;
  };
}) {
  const filled = Math.round((item.pct / 100) * 6);

  return (
    <article className="flex w-[223px] shrink-0 flex-col gap-3 overflow-hidden rounded-[12px] bg-[#141414] p-1.5 lg:w-[293px] lg:p-1">
      <CourseThumb image={item.image} seed={item.courseId} className="w-full" />
      <div className="px-1">
        <p className="truncate text-[14px] font-medium leading-[18px] text-[#fafafa]">{item.name}</p>
      </div>
      <div className="flex w-full flex-col gap-2 overflow-hidden rounded-[8px] bg-[#1f1f1f] px-2.5 py-2">
        <div className="flex items-center justify-between text-[10px] font-medium">
          <p className="text-white">{labels.percentCompleted.replace("{n}", String(item.pct))}</p>
          <p className="text-[#999]">{labels.hrsLeft.replace("{n}", String(item.hrsLeft))}</p>
        </div>
        <div className="flex h-[6px] items-center gap-[3px]">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="h-full min-w-px flex-1 overflow-hidden rounded-[3px] bg-[#333]">
              <span className={i < filled ? "block h-full w-full bg-[#0c5eff]" : "block h-full w-0"} />
            </span>
          ))}
        </div>
        {item.nextName ? (
          <p className="truncate text-[10px] text-[#999]">
            {labels.nextLesson} {item.nextName}
          </p>
        ) : null}
        {item.watchedMin ? (
          <p className="truncate text-[10px] text-[#999]">
            {labels.watchedMin.replace("{n}", String(item.watchedMin))}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-[10px] px-1 pb-1">
        <p className="min-w-0 flex-1 text-[10px] leading-normal text-[#999]">
          {labels.lastStudied}
          {item.lastStudied ? (
            <>
              <br />
              {item.lastStudied}
            </>
          ) : null}
        </p>
        <Link
          href={`/course/${item.courseId}/learn`}
          className="flex shrink-0 items-center gap-[3px] overflow-hidden rounded-[16px] bg-[#f6360b] px-[10px] py-2"
        >
          <span className="text-[12px] font-medium text-white">{labels.resume}</span>
          <span className="size-[14px]">
            <HomeIcon src="/home/chevron-right.svg" />
          </span>
        </Link>
      </div>
    </article>
  );
}
