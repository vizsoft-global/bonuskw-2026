"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, limit, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { SubscriptionDoc } from "@/lib/types/firestore";

/** The student's ongoing enrolment in a course, if any. */
export function useCourseSubscription(courseId?: string, userId?: string | null) {
  return useQuery({
    queryKey: ["subscription", courseId ?? "", userId ?? ""],
    enabled: Boolean(courseId && userId),
    staleTime: 30_000,
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(getDb(), collections.subscription),
          where("userRef", "==", doc(getDb(), collections.users, userId!)),
          where("courseRef", "==", doc(getDb(), collections.course, courseId!)),
          where("status", "==", "Ongoing"),
          limit(1),
        ),
      );
      const d = snap.docs[0];
      return d ? ({ id: d.id, ...(d.data() as SubscriptionDoc) } as SubscriptionDoc & { id: string }) : null;
    },
  });
}
