import Link from "next/link";
import { BatchBadge, CourseThumb } from "./course-thumb";
import { HomeIcon } from "./icon";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/ui/haptics";

export const exploreGridClass =
  "grid grid-cols-2 gap-x-5 gap-y-6 lg:gap-[25px]";
export const exploreRailClass =
  "flex gap-[15px] overflow-x-auto hide-scrollbar lg:gap-[25px]";

export type ExploreItem = {
  id: string;
  name: string;
  image?: string;
  rating: number;
  author?: string;
  lessons?: number;
  hours?: number;
  pages?: number;
  batch?: string;
  saved?: boolean;
  href?: string;
  aspect?: "5/3" | "3/4";
};

export type ExploreLabels = {
  enroll: string;
  lessons: string;
  hrs: string;
  save: string;
  saved: string;
  pages?: string;
};

function itemHref(item: ExploreItem) {
  return item.href || `/course/${item.id}`;
}

function Meta({
  item,
  labels,
}: {
  item: ExploreItem;
  labels: ExploreLabels;
}) {
  if (typeof item.pages === "number") {
    if (item.pages <= 0) return null;
    return (
      <div className="flex min-w-0 items-center gap-[5px]">
        <span className="size-[10px] shrink-0 lg:size-3">
          <HomeIcon src="/home/book-bookmark.svg" />
        </span>
        <p className="truncate text-[10px] font-medium leading-none text-[#999] lg:text-[12px]">
          {item.pages} {labels.pages}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <div className="flex items-center gap-[5px]">
        <span className="size-[10px] shrink-0 lg:size-3">
          <HomeIcon src="/home/lesson.svg" />
        </span>
        <p className="truncate text-[10px] font-medium leading-none text-[#999] lg:text-[12px]">
          {item.lessons ?? 0} {labels.lessons}
        </p>
      </div>
      <div className="flex items-center gap-[5px]">
        <span className="size-[10px] shrink-0 lg:size-3">
          <HomeIcon src="/home/duration.svg" />
        </span>
        <p className="truncate text-[10px] font-medium leading-none text-[#999] lg:text-[12px]">
          {item.hours ?? 0} {labels.hrs}
        </p>
      </div>
    </div>
  );
}

function RatingRow({ item }: { item: ExploreItem }) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className="flex items-center gap-[2px]">
        <span className="size-3 shrink-0">
          <HomeIcon src="/home/star.svg" />
        </span>
        <span className="text-[10px] leading-none text-[#999] lg:text-[12px]">{item.rating.toFixed(1)}</span>
      </span>
      <span className="h-[10px] w-px bg-white/20 lg:h-3" />
      {item.author ? (
        <p className="truncate text-[10px] leading-none text-[#999] lg:text-[12px]">{item.author}</p>
      ) : null}
    </div>
  );
}

function SaveButton({
  item,
  labels,
  onSave,
}: {
  item: ExploreItem;
  labels: ExploreLabels;
  onSave: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSave();
      }}
      aria-label={item.saved ? labels.saved : labels.save}
      aria-pressed={item.saved}
      className="absolute end-0.5 top-0.5 z-10 flex size-10 items-center justify-center"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-[#292929]">
        <span className="size-3.5">
          <HomeIcon src={item.saved ? "/home/bookmark-filled.svg" : "/home/bookmark.svg"} />
        </span>
      </span>
    </button>
  );
}

function CardActions({
  item,
  labels,
  onEnroll,
  enrollBlocked,
}: {
  item: ExploreItem;
  labels: ExploreLabels;
  onEnroll: () => void;
  enrollBlocked?: string;
}) {
  return (
    <div className="mt-auto flex w-full items-end justify-between gap-2.5 px-1 pb-1">
      <Meta item={item} labels={labels} />
      <button
        type="button"
        disabled={Boolean(enrollBlocked)}
        title={enrollBlocked}
        onClick={() => {
          if (enrollBlocked) return;
          haptic("medium");
          onEnroll();
        }}
        className={cn(
          "ms-auto flex h-7 shrink-0 items-center justify-center rounded-[16px] px-[15px] text-[12px] font-medium leading-none whitespace-nowrap lg:h-8",
          enrollBlocked ? "cursor-not-allowed bg-[#2a2a2a] text-[#999]" : "bg-[#0c5eff] text-white",
        )}
      >
        {enrollBlocked || labels.enroll}
      </button>
    </div>
  );
}

export function ExploreListCard({
  item,
  labels,
  onEnroll,
  onSave,
  enrollBlocked,
}: {
  item: ExploreItem;
  labels: ExploreLabels;
  onEnroll: () => void;
  onSave?: () => void;
  enrollBlocked?: string;
}) {
  const href = itemHref(item);
  const portrait = item.aspect === "3/4";
  return (
    <article className="relative flex w-full gap-3 overflow-hidden rounded-[12px] bg-[#141414] p-1.5">
      <div className={cn("relative shrink-0", portrait ? "w-[110px]" : "w-[154px]")}>
        <Link href={href} className="block">
          <CourseThumb image={item.image} seed={item.id} aspect={item.aspect} className={portrait ? "w-[110px]" : "w-[154px]"}>
            {item.batch ? <BatchBadge label={item.batch} /> : null}
          </CourseThumb>
        </Link>
        {onSave ? <SaveButton item={item} labels={labels} onSave={onSave} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
        <div className="flex flex-col gap-1.5 px-1">
          <Link href={href} className="line-clamp-2 text-[14px] font-medium leading-[18px] text-[#fafafa]">
            {item.name}
          </Link>
          <RatingRow item={item} />
        </div>
        <CardActions item={item} labels={labels} onEnroll={onEnroll} enrollBlocked={enrollBlocked} />
      </div>
    </article>
  );
}

export function ExploreGridCard({
  item,
  labels,
  onEnroll,
  onSave,
  enrollBlocked,
}: {
  item: ExploreItem;
  labels: ExploreLabels;
  onEnroll: () => void;
  onSave?: () => void;
  enrollBlocked?: string;
}) {
  const href = itemHref(item);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[12px] bg-[#141414] p-1.5 lg:p-1">
      <div className="relative shrink-0">
        <Link href={href} className="block">
          <CourseThumb image={item.image} seed={item.id} aspect={item.aspect} className="w-full">
            {item.batch ? <BatchBadge label={item.batch} /> : null}
          </CourseThumb>
        </Link>
        {onSave ? <SaveButton item={item} labels={labels} onSave={onSave} /> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2.5 pt-2.5 lg:gap-3 lg:pt-3">
        <div className="flex flex-col gap-1.5 px-1">
          <Link href={href} className="line-clamp-2 text-[12px] font-medium leading-[16px] text-[#fafafa]">
            {item.name}
          </Link>
          <RatingRow item={item} />
        </div>
        <CardActions item={item} labels={labels} onEnroll={onEnroll} enrollBlocked={enrollBlocked} />
      </div>
    </article>
  );
}
