"use client";

import { useState } from "react";
import { hasThumb, ThumbPlaceholder } from "@/components/home/course-thumb";
import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";

export function CourseCover({
  image,
  batchName,
  aspect = "5/3",
}: {
  image?: string;
  batchName?: string;
  aspect?: "5/3" | "3/4";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[12px] bg-[#141414]",
        aspect === "3/4" ? "aspect-[3/4]" : "aspect-[5/3]",
      )}
    >
      {hasThumb(image) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <ThumbPlaceholder />
      )}
      {batchName ? (
        <span className="absolute bottom-3 end-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-[#fafafa]">
          {batchName}
        </span>
      ) : null}
    </div>
  );
}

function Face({ letters }: { letters: string }) {
  return (
    <span className="grid size-6 place-items-center overflow-hidden rounded-full border border-[#666] bg-[#2a2a2a] text-[8px] font-semibold leading-none tracking-tight text-[#c8c8c8] ring-2 ring-[#050505]">
      {letters}
    </span>
  );
}

export function CourseInfo({
  sku,
  language,
  title,
  rating,
  ratingLabel,
  enrolled,
  enrolledLabel,
  description,
  seeMore,
  seeLess,
}: {
  sku?: string;
  language?: string;
  title: string;
  rating: number;
  ratingLabel: string;
  enrolled: number;
  enrolledLabel: string;
  description?: string;
  seeMore: string;
  seeLess: string;
}) {
  const [open, setOpen] = useState(false);
  const text = description?.trim() || "";
  const long = text.length > 160;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {sku ? <span className="text-[12px] text-[#999]">{sku}</span> : null}
        {language ? (
          <span className="flex items-center gap-1 rounded-full bg-[#141414] px-2 py-1 text-[11px] text-[#999]">
            <span className="size-3">
              <HomeIcon src="/course/translate.svg" />
            </span>
            {language}
          </span>
        ) : null}
      </div>

      <p className="text-[20px] font-semibold leading-7 text-[#fafafa] lg:text-[24px]">{title}</p>

      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#999]">
        <span className="flex items-center gap-1 rounded-full bg-[#141414] px-2.5 py-1.5 text-[#fafafa]">
          <span className="size-3.5">
            <HomeIcon src="/course/star.svg" />
          </span>
          <span className="font-medium">{rating.toFixed(1)}</span>
          <span className="text-[#999]">{ratingLabel}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex -space-x-2 rtl:space-x-reverse">
            {["B", "A", "S"].map((letters) => (
              <Face key={letters} letters={letters} />
            ))}
          </span>
          <span>{enrolledLabel.replace("{n}", String(enrolled))}</span>
        </span>
      </div>

      {text ? (
        <div>
          <p className={cn("text-[13px] leading-5 text-[#999]", !open && long && "line-clamp-3")}>{text}</p>
          {long ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 text-[13px] font-medium text-[#f24822]"
            >
              {open ? seeLess : seeMore}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
