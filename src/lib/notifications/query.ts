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
  /** A campaign can carry a picture; the row shows it in place of the icon. */
  imageUrl: string | null;
  /** Where a campaign's button points, when it has one. */
  linkUrl: string | null;
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
          // Older rows keep the link and image inside `parameter_data`.
          let params: { url?: string; image?: string } = {};
          try {
            params = JSON.parse(String(doc.get("parameter_data") || "{}")) as typeof params;
          } catch {
            params = {};
          }
          return {
            id: doc.id,
            title,
            text: text || title,
            createdAt: asDate(doc.get("created_at") || doc.get("timestamp")),
            imageUrl: String(doc.get("image_url") || params.image || "").trim() || null,
            linkUrl: String(doc.get("link_url") || params.url || "").trim() || null,
          } satisfies NotificationItem;
        })
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .slice(0, 30);
    },
  });
}
