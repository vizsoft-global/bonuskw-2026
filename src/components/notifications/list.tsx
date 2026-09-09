"use client";

import { formatDistanceToNow } from "date-fns";
import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/notifications/query";

function SparkleMark({ read }: { read: boolean }) {
  return (
    <span
      className={cn(
        "relative size-[35px] shrink-0 overflow-hidden rounded-full",
        read ? "bg-[#3a3a3a]" : "bg-[linear-gradient(180deg,#3b82f6_0%,#000_100%)]",
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
            onClick={() => onOpen?.(note.id)}
            className={cn(
              "flex w-full items-center justify-between gap-2.5 py-[10px] text-start",
              !last && "border-b border-white/10",
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <SparkleMark read={read} />
              <span
                className={cn(
                  "min-w-0 flex-1 text-[12px] font-medium leading-normal",
                  read ? "text-[#666]" : "text-white",
                )}
              >
                {note.text}
              </span>
            </span>
            {note.createdAt ? (
              <span className={cn("shrink-0 text-[10px] font-medium", read ? "text-[#666]" : "text-white")}>
                {formatDistanceToNow(note.createdAt, { addSuffix: true })}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
