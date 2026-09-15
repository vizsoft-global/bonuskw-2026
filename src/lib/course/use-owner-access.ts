"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import { getBatch, getCourse } from "@/lib/catalog/queries";
import { hasOwnerAccess } from "./owner-access";

/**
 * Whether this account sees the whole course without an enrolment: its
 * instructor or a co-instructor, or a university manager for a course in their
 * own university. Shares the pages' query keys, so it costs no extra reads.
 */
export function useOwnerAccess(courseId?: string) {
  const { user, profile } = useAuth();
  const course = useQuery({
    queryKey: ["course", courseId ?? ""],
    queryFn: () => getCourse(courseId!),
    enabled: Boolean(courseId),
  });
  const batchId = course.data?.batchesRef?.id;
  const batch = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => getBatch(batchId),
    enabled: Boolean(batchId),
  });
  return hasOwnerAccess({
    course: course.data ?? null,
    profile,
    uid: user?.uid,
    batch: batch.data ?? null,
  });
}
