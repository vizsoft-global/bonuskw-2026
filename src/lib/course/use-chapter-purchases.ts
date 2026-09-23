"use client";

import { useQuery } from "@tanstack/react-query";
import { loadPurchasedChapterIds } from "@/lib/course/chapter-purchases";

/**
 * Chapters the student bought individually in this course. Kept apart from the
 * course subscription on purpose: owning a chapter is not being enrolled, and
 * the two unlock different things (tests stay with the full course).
 */
export function usePurchasedChapterIds(courseId?: string, userId?: string | null) {
  return useQuery({
    queryKey: ["chapter-access", courseId ?? "", userId ?? ""],
    enabled: Boolean(courseId && userId),
    staleTime: 30_000,
    queryFn: () => loadPurchasedChapterIds(userId!, courseId!),
  });
}
