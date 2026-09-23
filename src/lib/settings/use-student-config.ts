"use client";

import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { PurchaseControls } from "@/lib/types/firestore";

/** `adminConfig/studentApp` — written by the admin panel (Settings > Student app). */
export type StudentConfig = {
  minWebBuild?: string;
  termsConditions?: { en?: string; ar?: string; version?: number };
  privacy?: { en?: string; ar?: string; version?: number };
  devicePolicy?: { maxDevices30d?: number; maxCitiesPerDay?: number };
  supportWhatsapp?: string;
  supportEmail?: string;
  maintenance?: { enabled?: boolean; until?: number; message?: { en?: string; ar?: string } };
  /** Fail-safe purchase switches (Settings > Purchases & dev mode). */
  purchases?: PurchaseControls;
  /**
   * Super-admin only (Settings > General > Curriculum). Chapter titles read
   * "Chapter 3: Algebra" unless this is explicitly false.
   */
  chapterPrefix?: boolean;
  /** Settings > General > Course cards: the lesson count and runtime on cards. */
  showLessonsAndHours?: boolean;
};

export async function fetchStudentConfig(): Promise<StudentConfig> {
  const snap = await getDoc(doc(getDb(), collections.adminConfig, "studentApp"));
  return (snap.data() as StudentConfig | undefined) ?? {};
}

export function useStudentConfig() {
  return useQuery({
    queryKey: ["adminConfig", "studentApp"],
    queryFn: fetchStudentConfig,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Whether chapter titles carry their "Chapter N:" prefix. Absent means yes, so
 * the historical behaviour stands until a super admin switches it off.
 *
 * Comes from `/api/student-config` rather than the document itself: the rules
 * only let signed-in users read `adminConfig`, so a guest used to fall back to
 * the default and see numbers after they had been switched off.
 */
export function useChapterNumbers() {
  const { data } = useQuery({
    queryKey: ["student-config", "chapterPrefix"],
    queryFn: async () => {
      const res = await fetch("/api/student-config", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load student config");
      return (await res.json()) as { chapterPrefix?: boolean };
    },
    staleTime: 10 * 60 * 1000,
  });
  return data?.chapterPrefix !== false;
}

/**
 * Whether course cards and the course page say how many lessons a course has
 * and how long it runs. Absent means off, so both stay hidden until an admin
 * switches them on (Settings > General > Course cards).
 *
 * Comes from `/api/student-config` for the same reason chapter numbers do: the
 * rules only let signed-in users read `adminConfig`, so reading the document
 * directly would leave a guest on the default. The cache is short so an admin
 * sees the change on the next reload rather than ten minutes later.
 */
export function useLessonsAndHours() {
  const { data } = useQuery({
    queryKey: ["student-config", "showLessonsAndHours"],
    queryFn: async () => {
      const res = await fetch("/api/student-config", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load student config");
      return (await res.json()) as { showLessonsAndHours?: boolean };
    },
    staleTime: 60 * 1000,
  });
  return data?.showLessonsAndHours === true;
}
