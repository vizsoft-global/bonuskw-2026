"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { asDate } from "@/lib/format";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";

export type NotificationItem = {
  id: string;
  text: string;
  createdAt: Date | null;
};

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const snap = await getDocs(query(collection(getDb(), collections.announcement), limit(30)));
      return snap.docs
        .map((doc) => {
          const title = String(doc.get("title") || "");
          const bio = String(doc.get("bio") || doc.get("body") || doc.get("message") || "");
          return {
            id: doc.id,
            text: bio || title,
            createdAt: asDate(doc.get("createdAt") || doc.get("created_at") || doc.get("date") || doc.get("timestamp")),
          } satisfies NotificationItem;
        })
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    },
  });
}
