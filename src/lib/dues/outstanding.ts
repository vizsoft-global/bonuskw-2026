"use client";

import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-provider";
import { collections } from "@/lib/firebase/collections";
import { getDb } from "@/lib/firebase/client";

/** One outstanding installment, as stored in `installments`. */
export type OutstandingDue = QueryDocumentSnapshot;

/** The day a tranche opens. `dueEndDate` is the fallback for older rows. */
export function dueAt(due: OutstandingDue): Date | null {
  const raw = due.get("dueDate") ?? due.get("dueEndDate");
  const date = raw?.toDate?.() as Date | undefined;
  return date ?? null;
}

/** Whole days from today to `date`; negative once it has passed. */
export function daysUntil(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Overdue is decided by the status the reminder cron maintains, with the date as
 * a fallback: a tranche whose day has passed but which has not been flipped yet
 * is still late, and telling the student otherwise would be wrong.
 */
export function isOverdue(due: OutstandingDue): boolean {
  if (due.get("status") === "overdue") return true;
  const at = dueAt(due);
  return at ? daysUntil(at) < 0 : false;
}

/**
 * Everything the student still owes — shared by the installments screen and by
 * the banner above it.
 *
 * One query key for both, so the banner costs nothing extra on a page that has
 * already loaded the list, and the two can never disagree about what is
 * outstanding. Deriving it twice is how a notice and the page it points at end
 * up saying different things.
 */
export function useOutstandingDues() {
  const { user } = useAuth();
  const dues = useQuery({
    queryKey: ["dues", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(getDb(), collections.installments),
          where("userRef", "==", doc(getDb(), collections.users, user!.uid)),
        ),
      );
      return snap.docs.filter((d) => d.get("status") === "due" || d.get("status") === "overdue");
    },
  });
  return { ...dues, signedIn: Boolean(user) };
}
