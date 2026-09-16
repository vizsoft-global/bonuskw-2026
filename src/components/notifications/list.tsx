"use client";

import { formatDistanceToNow } from "date-fns";
import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/notifications/query";

function SparkleMark({ read, imageUrl }: { read: boolean; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <span className="relative size-[35px] shrink-0 overflow-hidden rounded-full bg-surface-2">
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative size-[35px] shrink-0 overflow-hidden rounded-full",
        read ? "bg-surface-2" : "bg-[linear-gradient(180deg,#3b82f6_0%,#000_100%)]",
      )}
    >
      <span className="absolute start-[9px] top-[9px] size-[17px]">
        <HomeIcon src="/notifications/sparkle.svg" />
      </span>
    </span>
  );
}

export function NotificationRows({
  notes,
  readIds,
  onOpen,
}: {
  notes: NotificationItem[];
  readIds: string[];
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="flex w-full flex-col">
      {notes.map((note, i) => {
        const read = readIds.includes(note.id);
        const last = i === notes.length - 1;
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => {
              onOpen?.(note.id);
              // A campaign's button: open where it points, without losing the
              // read state that the click just recorded.
              if (note.linkUrl) window.open(note.linkUrl, "_blank", "noopener,noreferrer");
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2.5 py-[10px] text-start",
              !last && "border-b border-line",
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <SparkleMark read={read} imageUrl={note.imageUrl} />
              <span className="min-w-0 flex-1">
                {note.title && note.title !== note.text ? (
                  <span className={cn("block truncate text-[12px] font-semibold", read ? "text-faint" : "text-text")}>
                    {note.title}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "block text-[12px] font-medium leading-normal",
                    read ? "text-faint" : note.title && note.title !== note.text ? "text-muted" : "text-text",
                  )}
                >
                  {note.text}
                </span>
              </span>
            </span>
            {note.createdAt ? (
              <span className={cn("shrink-0 text-[10px] font-medium", read ? "text-faint" : "text-text")}>
                {formatDistanceToNow(note.createdAt, { addSuffix: true })}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
