"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ClearAllButton, NotificationInbox, useVisibleNotifications } from "@/components/notifications/inbox";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useI18n } from "@/lib/i18n/locale";

export default function NotificationsInboxPage() {
  const { t } = useI18n();
  const { notes } = useVisibleNotifications();
  return (
    <AppShell
      compactHeader
      loading={notes.isPending}
      title={t("notifications")}
      actions={<ClearAllButton />}
      skeleton={<ListPageSkeleton />}
    >
      <NotificationInbox />
    </AppShell>
  );
}
