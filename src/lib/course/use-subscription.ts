"use client";

import { useQuery } from "@tanstack/react-query";
import { loadLiveSubscription } from "@/lib/course/enrollments";

/**
 * The student's live enrolment in a course, if any: Ongoing, course published,
 * and its batch still running. Ended terms and drafted courses return null.
 */
export function useCourseSubscription(courseId?: string, userId?: string | null) {
  return useQuery({
    queryKey: ["subscription", courseId ?? "", userId ?? ""],
    enabled: Boolean(courseId && userId),
    staleTime: 30_000,
    queryFn: () => loadLiveSubscription(userId!, courseId!),
  });
}
