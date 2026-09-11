"use client";

import { DownloadCircle, FileDownloadIcon, FileTileArt, fileTypeLabel } from "@/components/course/file-art";
import { HomeIcon } from "@/components/home/icon";
import { formatBytes } from "@/lib/course/resource-kind";
import type { OutlineFile } from "@/lib/course/outline";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

/**
 * Files of the lesson being watched: file tile, name, "PDF · 2.4 MB" and a
 * download circle. `dense` is the desktop side panel (40px tiles); the default
 * is the mobile Resources tab (55px tiles).
 */
export function ResourceList({
  files,
  onOpen,
  dense,
  emptyLabel,
}: {
  files: OutlineFile[];
  onOpen: (file: OutlineFile) => void;
  dense?: boolean;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  if (!files.length) {
    return <p className="py-6 text-center text-[12px] text-[#999]">{emptyLabel ?? t("noLessonFiles")}</p>;
  }
  return (
    <ul className="flex flex-col">
      {files.map((file) => (
        <li key={file.id} className="border-b border-white/10 last:border-b-0">
          <button
            type="button"
            disabled={file.locked}
            onClick={() => onOpen(file)}
            className={cn(
              "flex w-full items-center gap-[15px] text-start disabled:opacity-60",
              dense ? "py-2.5 pe-1" : "py-[15px] pe-2.5",
            )}
          >
            <FileTileArt file={file} className={dense ? "size-10 rounded-[8px]" : "size-[55px]"} />
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="line-clamp-2 text-[12px] font-medium leading-[15px] text-[#fafafa]">{file.name}</span>
              <span className={cn("mt-1.5 flex items-center gap-2.5 font-medium text-[#999]", dense ? "text-[10px]" : "text-[12px]")}>
                <span className="flex items-center gap-1">
                  <span className={dense ? "size-2.5" : "size-3"}>
                    <HomeIcon src="/course/paperclip.svg" />
                  </span>
                  {fileTypeLabel(file)}
                </span>
                {file.bytes ? (
                  <span className="flex items-center gap-1">
                    <FileDownloadIcon className={dense ? "size-2.5" : "size-3"} />
                    {formatBytes(file.bytes)}
                  </span>
                ) : null}
              </span>
            </span>
            {file.locked ? (
              <span className="size-4 shrink-0">
                <HomeIcon src="/course/lock.svg" />
              </span>
            ) : (
              <DownloadCircle className="size-5 shrink-0 text-[#fafafa]" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
