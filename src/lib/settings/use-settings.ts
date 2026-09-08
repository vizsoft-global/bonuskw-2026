"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { SettingsDoc, SettingsStory } from "@/lib/types/firestore";

/**
 * The legacy `settings` collection holds one document with `type: "Main"`
 * (logo, stories, terms, feature flags). The student-app specific config lives
 * in `adminConfig/studentApp` and is read separately by `useStudentConfig`.
 */
export type MainSettings = SettingsDoc & {
  id: string;
  termsConditions?: string;
  general?: { email?: string; phone?: string; whatsapp?: string; instaLink?: string };
  wishList?: boolean;
  recommendedSection?: boolean;
  topCourse?: boolean;
};

export async function fetchMainSettings(): Promise<MainSettings | null> {
  const snap = await getDocs(
    query(collection(getDb(), collections.settings), where("type", "==", "Main"), limit(1)),
  );
  const first = snap.docs[0];
  if (!first) return null;
  return { id: first.id, ...(first.data() as SettingsDoc) };
}

export function useMainSettings() {
  return useQuery({
    queryKey: ["settings", "main"],
    queryFn: fetchMainSettings,
    staleTime: 10 * 60 * 1000,
  });
}

export type StoryItem = SettingsStory & {
  id?: number | string;
  description?: string;
  redirect_url?: string;
  video_url?: string;
  created_at?: unknown;
};

/** Stories that are non-empty and inside their optional date window. */
export function activeStories(settings?: MainSettings | null, now = new Date()): StoryItem[] {
  const items = (settings?.settings_status ?? []) as StoryItem[];
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const hasMedia = Boolean(item.image || item.video_url);
    if (!hasMedia) return false;
    if (item.status && String(item.status).toLowerCase() === "inactive") return false;
    const start = toDate(item.startDate);
    const end = toDate(item.endDate);
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  });
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const candidate = value as { toDate?: () => Date };
  return typeof candidate.toDate === "function" ? candidate.toDate() : null;
}
