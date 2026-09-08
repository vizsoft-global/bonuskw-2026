import type { CourseDoc } from "@/lib/types/firestore";

export type CourseStatus = "Publish" | "Draft" | "Archived";

/**
 * Production stores published courses as both "Publish" and "Published". Filter
 * on the raw value and one of the two sets disappears from the list, so every
 * read collapses them here. Courses with no status are drafts.
 */
export function normalizeCourseStatus(status?: string | null): CourseStatus {
  if (status === "Archived") return "Archived";
  if (status === "Publish" || status === "Published") return "Publish";
  return "Draft";
}

export function isPublished(course?: Pick<CourseDoc, "status"> | null) {
  return normalizeCourseStatus(course?.status) === "Publish";
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  Publish: "Published",
  Draft: "Draft",
  Archived: "Archived",
};

/**
 * Placement is an array holding at most one string rather than two booleans.
 * `[]` means the course appears in neither the recommended nor featured rail.
 */
export function placementOf(course?: Pick<CourseDoc, "listView"> | null) {
  const first = course?.listView?.[0];
  return first === "Recommended" || first === "Featured" ? first : "";
}

export function placementUpdate(value: string) {
  return { listView: value ? [value] : [] };
}
