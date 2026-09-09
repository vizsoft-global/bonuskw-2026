"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { asDate } from "@/lib/format";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";

export type NotificationItem = {
  id: string;
  title: string;
  text: string;
  createdAt: Date | null;
};

/**
 * The student's inbox: push notifications addressed to them (admin "Send
 * notification", EMI reminders) plus broadcasts sent with no recipient list.
 * Announcements were retired in favour of stories and popups.
 */
export function useUserNotifications() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return useQuery({
    queryKey: ["notifications", uid],
    enabled: Boolean(uid),
    staleTime: 60_000,
    queryFn: async () => {
      // Equality only (no orderBy) so no composite index is needed; sorted below.
      const snap = await getDocs(
        query(
          collection(getDb(), collections.ff_push_notifications),
          where("user_refs", "in", [`users/${uid}`, ""]),
          limit(60),
        ),
      );
      return snap.docs
        .map((doc) => {
          const title = String(doc.get("notification_title") || "");
          const text = String(doc.get("notification_text") || "");
          return {
            id: doc.id,
            title,
            text: text || title,
            createdAt: asDate(doc.get("created_at") || doc.get("timestamp")),
          } satisfies NotificationItem;
        })
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .slice(0, 30);
    },
  });
}
