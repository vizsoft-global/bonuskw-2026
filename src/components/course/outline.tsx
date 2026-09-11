"use client";

import type { ResourceKind } from "@/lib/course/resource-kind";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ResourceKind, string> = {
  pdf: "PDF",
  image: "IMAGE",
  audio: "AUDIO",
  video: "VIDEO",
  file: "FILE",
};

/** Document-style thumbnail with a badge for the file type. */
export function FileThumb({ kind, className }: { kind: ResourceKind; className?: string }) {
  const tone =
    kind === "pdf"
      ? "bg-[#f24822]"
      : kind === "audio"
        ? "bg-[#8b5cf6]"
        : kind === "video"
          ? "bg-[#0c5eff]"
          : kind === "image"
            ? "bg-[#10b981]"
            : "bg-[#545454]";
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] border-[0.5px] border-white/25 bg-[#1d1d1d]",
        className,
      )}
    >
      <span className="absolute inset-x-[22%] top-[14%] bottom-[18%] rounded-[3px] border border-white/30 bg-white/[0.08]" />
      <span className={cn("relative rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white", tone)}>
        {KIND_LABEL[kind]}
      </span>
    </span>
  );
}
