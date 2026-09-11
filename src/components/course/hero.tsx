"use client";

import { useState } from "react";
import { hasThumb, ThumbPlaceholder } from "@/components/home/course-thumb";
import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";

/**
 * The course's own intro video, when it has one: the thumbnail becomes a play
 * button and the player takes its place once a ticket arrives.
 */
export type CoverVideo = {
  /** Embed URL once playback was granted; empty until then. */
  src: string;
  busy?: boolean;
  onPlay: () => void;
  label: string;
};

export function CourseCover({
  image,
  seed,
  batchName,
  aspect = "5/3",
  video,
}: {
  image?: string;
  /** Course id: colour of the default artwork. */
  seed?: string | null;
  batchName?: string;
  aspect?: "5/3" | "3/4" | "16/9";
  video?: CoverVideo;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[12px] bg-[#141414]",
        aspect === "3/4" ? "aspect-[3/4]" : aspect === "16/9" ? "aspect-video" : "aspect-[5/3]",
      )}
    >
      {video?.src ? (
        <iframe
          key={video.src}
          title={video.label}
          src={video.src}
          className="absolute inset-0 h-full w-full"
          allow="fullscreen; autoplay; encrypted-media"
        />
      ) : (
        <>
          {hasThumb(image) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <ThumbPlaceholder seed={seed} />
          )}
          {video ? (
            <button
              type="button"
              onClick={video.onPlay}
              disabled={video.busy}
              aria-label={video.label}
              className="absolute inset-0 grid place-items-center transition"
              style={{ background: "rgba(0,0,0,0.25)" }}
            >
              <span
                className="flex items-center gap-2 rounded-full py-2 pe-4 ps-2.5 text-[13px] font-medium ring-1 ring-white/25 backdrop-blur-sm"
                style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
              >
                <span className="grid size-7 place-items-center rounded-full bg-[#0c5eff]">
                  {video.busy ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="size-3.5 translate-x-px" fill="currentColor" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </span>
                {video.label}
              </span>
            </button>
          ) : null}
          {batchName ? (
            <span
              className="absolute bottom-3 end-3 rounded-full px-2.5 py-1 text-[11px]"
              style={{ background: "rgba(0,0,0,0.7)", color: "#fafafa" }}
            >
              {batchName}
            </span>
          ) : null}
        </>
      )}
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
    <div className="flex flex-col gap-2">
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

      <p className="text-[18px] font-semibold leading-6 text-[#fafafa] lg:text-[22px] lg:leading-7">{title}</p>

      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#999]">
        <span className="flex items-center gap-1 rounded-full bg-[#141414] px-2.5 py-1 text-[#fafafa]">
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
          <p className={cn("text-[13px] leading-5 text-[#999]", !open && long && "line-clamp-2 lg:line-clamp-3")}>{text}</p>
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
