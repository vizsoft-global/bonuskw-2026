"use client";

import Link from "next/link";
import { CourseThumb } from "@/components/home/course-thumb";
import { haptic } from "@/lib/ui/haptics";
import { cn } from "@/lib/utils";

export type OfferCourseCard = {
  id: string;
  name: string;
  image?: string;
  /** Formatted, already discounted when the promotion applies to the item. */
  price: string;
  /** Formatted original price; shown struck through only when it differs. */
  compareAt?: string;
  href: string;
};

export function OfferGridCard({
  course,
  addLabel,
  onAdd,
  blocked,
  busy,
}: {
  course: OfferCourseCard;
  addLabel: string;
  onAdd: () => void;
  blocked?: string;
  busy?: boolean;
}) {
  const disabled = Boolean(blocked) || Boolean(busy);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[12px] border border-line bg-surface p-1.5 lg:p-1">
      <div className="relative shrink-0">
        <Link href={course.href} className="block">
          <CourseThumb image={course.image} seed={course.id} aspect="3/4" className="w-full" />
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 pt-2 lg:gap-2">
        <Link
          href={course.href}
          className="line-clamp-2 px-1 text-[12px] font-medium leading-[16px] text-text"
        >
          {course.name}
        </Link>
        <div className="mt-auto flex w-full items-center justify-between gap-2.5 px-1 pb-0.5">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="truncate text-[13px] font-semibold leading-none text-text">
              {course.price}
            </span>
            {course.compareAt ? (
              <span className="truncate text-[10px] font-medium leading-none text-muted line-through">
                {course.compareAt}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={disabled}
            title={blocked}
            onClick={() => {
              if (disabled) return;
              haptic("medium");
              onAdd();
            }}
            className={cn(
              "ms-auto flex h-7 shrink-0 items-center justify-center rounded-[16px] px-[15px] text-[12px] font-medium leading-none whitespace-nowrap lg:h-8",
              disabled ? "cursor-not-allowed bg-surface-2 text-muted" : "bg-[#0c5eff] text-white",
            )}
          >
            {blocked || addLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
