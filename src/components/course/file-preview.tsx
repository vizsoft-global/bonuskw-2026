"use client";

import { useEffect } from "react";
import { DownloadCircle, FileGlyph, fileTypeLabel, isPreviewable } from "@/components/course/file-art";
import { formatBytes } from "@/lib/course/resource-kind";
import type { OutlineFile } from "@/lib/course/outline";
import { useI18n } from "@/lib/i18n/locale";

export function downloadFile(file: OutlineFile) {
  window.open(file.url, "_blank", "noopener,noreferrer");
}

/**
 * PDFs and images open here, on top of the page, instead of replacing the
 * video. Other file types go straight to download.
 */
export function FilePreview({ file, onClose }: { file: OutlineFile; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const previewable = isPreviewable(file);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col p-3 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <FileGlyph file={file} className="w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium" style={{ color: "#fff" }}>
              {file.name}
            </p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {fileTypeLabel(file)}
              {file.bytes ? ` · ${formatBytes(file.bytes)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadFile(file)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#0c5eff] px-3 text-[12px] font-semibold text-white"
          >
            <DownloadCircle className="size-4" />
            {t("download")}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-[16px] bg-[#1d1d1d] ring-1 ring-white/10">
          {!previewable ? (
            <div className="grid h-full place-items-center px-6 text-center text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t("previewUnavailable")}
            </div>
          ) : file.kind === "image" ? (
            <div className="grid h-full place-items-center bg-black/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <iframe title={file.name} src={`${file.url}#toolbar=0&view=FitH`} className="h-full w-full bg-white" />
          )}
        </div>
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 self-center text-[12px] underline-offset-2 hover:underline"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {t("openInNewTab")}
        </a>
      </div>
    </div>
  );
}
