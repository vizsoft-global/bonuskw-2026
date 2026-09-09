"use client";

import { useMemo, useSyncExternalStore } from "react";
import { NotificationRows } from "@/components/notifications/list";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/skeleton";
import { useI18n } from "@/lib/i18n/locale";
import { useUserNotifications } from "@/lib/notifications/query";
import {
  clearAllNotes,
  getNotesStateServerSnapshot,
  getNotesStateSnapshot,
  markNoteRead,
  parseNotesState,
  subscribeNotesState,
} from "@/lib/notifications/state";

export function useVisibleNotifications() {
  const notes = useUserNotifications();
  const raw = useSyncExternalStore(subscribeNotesState, getNotesStateSnapshot, getNotesStateServerSnapshot);
  const state = parseNotesState(raw);
  const visible = useMemo(
    () => (notes.data ?? []).filter((note) => !state.cleared.includes(note.id)),
    [notes.data, state.cleared],
  );
  const unread = visible.filter((note) => !state.read.includes(note.id)).length;
  return { notes, visible, unread, readIds: state.read };
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 border-b border-white/10 py-[10px] last:border-0">
          <Skeleton className="size-[35px] rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}

export function NotificationInbox({
  onSelect,
  compact,
}: {
  onSelect?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { notes, visible, readIds } = useVisibleNotifications();

  if (notes.isPending) return <InboxSkeleton />;
  if (!visible.length) {
    return (
      <EmptyState
        compact={compact}
        icon="/home/bell.svg"
        title={t("emptyNotificationsTitle")}
        body={t("emptyNotificationsBody")}
      />
    );
  }

  return (
    <NotificationRows
      notes={visible}
      readIds={readIds}
      onOpen={(id) => {
        markNoteRead(id);
        onSelect?.();
      }}
    />
  );
}

export function ClearAllButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const { visible } = useVisibleNotifications();
  if (!visible.length) return null;
  return (
    <button
      type="button"
      onClick={() => clearAllNotes(visible.map((note) => note.id))}
      className={className ?? "cursor-pointer text-[12px] font-medium text-[#ed4a27]"}
    >
      {t("clearAll")}
    </button>
  );
}
