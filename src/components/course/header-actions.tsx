"use client";

import { HomeIcon } from "@/components/home/icon";

export function CourseHeaderActions({
  saved,
  onShare,
  onSave,
  shareLabel,
  saveLabel,
}: {
  saved: boolean;
  onShare: () => void;
  onSave: () => void;
  shareLabel: string;
  saveLabel: string;
}) {
  return (
    <>
      <button type="button" onClick={onShare} aria-label={shareLabel} className="grid size-6 place-items-center">
        <span className="size-5">
          <HomeIcon src="/course/share.svg" />
        </span>
      </button>
      <button type="button" onClick={onSave} aria-label={saveLabel} className="grid size-6 place-items-center">
        <span className="size-5">
          <HomeIcon src={saved ? "/course/heart-filled.svg" : "/course/heart.svg"} />
        </span>
      </button>
    </>
  );
}
