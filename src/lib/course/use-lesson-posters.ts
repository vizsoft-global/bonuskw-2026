"use client";

import { useQuery } from "@tanstack/react-query";
import { getDocsByIds } from "@/lib/catalog/queries";
import { collections } from "@/lib/firebase/collections";

type LessonRef = { id: string; videoRef?: { id?: string } | null };

/**
 * Video posters for lessons that have no thumbnail of their own, keyed by
 * lesson id. Lessons point at `videos` through `videoRef`; the poster's
 * `images` field becomes the card thumbnail so a video never renders as a
 * bare title box.
 */
export function useLessonPosters(lessons: LessonRef[] | undefined) {
  const videoIds = [...new Set((lessons ?? []).map((l) => l.videoRef?.id).filter((v): v is string => Boolean(v)))].sort();
  return useQuery({
    queryKey: ["lesson-posters", videoIds.join(",")],
    enabled: videoIds.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const rows = await getDocsByIds(collections.videos, videoIds);
      const byVideo: Record<string, string> = {};
      for (const [vid, doc] of Object.entries(rows)) {
        const img = (doc as { images?: unknown }).images;
        if (typeof img === "string" && img) byVideo[vid] = img;
      }
      const out: Record<string, string> = {};
      for (const lesson of lessons ?? []) {
        const vid = lesson.videoRef?.id;
        if (vid && byVideo[vid]) out[lesson.id] = byVideo[vid];
      }
      return out;
    },
  });
}
