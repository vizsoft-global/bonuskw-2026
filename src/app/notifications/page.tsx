"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function NotificationsInboxPage() {
  const { t } = useI18n();
  const notes = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => getDocs(query(collection(getDb(), collections.announcement), limit(30))),
  });
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("notifications")}</h1>
      {(notes.data?.docs ?? []).map((note) => (
        <article key={note.id} className="mb-2 rounded-2xl border border-line p-3 text-sm">
          <p className="font-medium">{note.get("title")}</p>
          <p className="text-muted">{note.get("bio")}</p>
        </article>
      ))}
    </AppShell>
  );
}
