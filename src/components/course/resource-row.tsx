"use client";

import { HomeIcon } from "@/components/home/icon";

export function fileNameFromUrl(url: string) {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const name = path.split("/").pop();
    return name || url;
  } catch {
    const name = url.split("?")[0]?.split("/").pop();
    return name || url;
  }
}

export function fileTypeFromUrl(url: string) {
  const name = fileNameFromUrl(url);
  const ext = name.split(".").pop()?.toUpperCase();
  if (ext && ext !== name.toUpperCase() && ext.length <= 5) return ext;
  return "FILE";
}

export function ResourceRow({
  name,
  type,
  size,
  locked = true,
  downloadLabel,
  onDownload,
}: {
  name: string;
  type: string;
  size?: string;
  locked?: boolean;
  downloadLabel?: string;
  onDownload?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#141414]">
        <span className="size-4">
          <HomeIcon src="/course/paperclip.svg" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[#fafafa]">{name}</span>
        <span className="text-[11px] text-[#999]">
          {type}
          {size ? ` · ${size}` : ""}
        </span>
      </span>
      {locked ? (
        <span className="size-4 shrink-0">
          <HomeIcon src="/course/lock.svg" />
        </span>
      ) : onDownload ? (
        <button type="button" onClick={onDownload} className="shrink-0 text-[12px] font-medium text-[#0c5eff]">
          {downloadLabel}
        </button>
      ) : null}
    </div>
  );
}
