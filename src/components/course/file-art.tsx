"use client";

import type { OutlineFile } from "@/lib/course/outline";
import type { ResourceKind } from "@/lib/course/resource-kind";
import { cn } from "@/lib/utils";

/** Short type label for a file: its extension when it has one, else the kind. */
export function fileTypeLabel(file: Pick<OutlineFile, "name" | "kind">) {
  const ext = file.name.split(".").pop()?.toUpperCase();
  if (ext && ext.length <= 5 && ext !== file.name.toUpperCase()) return ext;
  return file.kind.toUpperCase();
}

const BADGE: Record<ResourceKind, string> = {
  pdf: "#f24822",
  image: "#10b981",
  audio: "#8b5cf6",
  video: "#0c5eff",
  file: "#0c5eff",
};

/** Gradients behind a file card, as in the design: red for PDFs, blue for the rest. */
export function fileGradient(kind: ResourceKind) {
  return kind === "pdf"
    ? "linear-gradient(180deg,#4a0e00 0%,#181818 100%)"
    : "linear-gradient(180deg,#062052 0%,#181818 100%)";
}

/**
 * Document glyph with a folded corner and a type badge (PDF, ZIP…). Colours
 * are inline so they read the same on the light theme.
 */
export function FileGlyph({ file, className }: { file: Pick<OutlineFile, "name" | "kind">; className?: string }) {
  const label = fileTypeLabel(file);
  return (
    <span className={cn("relative block aspect-square", className)} aria-hidden>
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" fill="none">
        <path
          d="M8 4h16l8 8v24a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
          fill="#f4f4f5"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="0.75"
        />
        <path d="M24 4v8h8" fill="#c8c8cc" />
      </svg>
      <span
        className="absolute inset-x-[10%] top-[48%] flex h-[26%] items-center justify-center rounded-[2px] text-[38%] font-bold leading-none text-white"
        style={{ background: BADGE[file.kind], fontFamily: "var(--font-inter), system-ui" }}
      >
        {label}
      </span>
    </span>
  );
}

/** Square 55px-style tile used in resource lists. */
export function FileTileArt({ file, className }: { file: Pick<OutlineFile, "name" | "kind">; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-[12px] border-[0.5px] border-white/25 bg-[#252525]",
        className,
      )}
    >
      <FileGlyph file={file} className="w-[55%]" />
    </span>
  );
}

/** Circle-with-arrow download icon from the design. */
export function DownloadCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("size-5", className)} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="10" cy="10" r="8.5" />
      <path d="M10 5.5v8M6.8 10.6 10 13.8l3.2-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small "document with arrow" icon used next to resource counts. */
export function FileDownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-3", className)} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Whether a file can be shown in the preview dialog instead of downloaded. */
export function isPreviewable(file: Pick<OutlineFile, "kind">) {
  return file.kind === "pdf" || file.kind === "image";
}
