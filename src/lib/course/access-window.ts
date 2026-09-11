import { asDate } from "@/lib/format";
import { isPublished } from "@/lib/course/status";
import type { BatchDoc, CourseDoc } from "@/lib/types/firestore";

/**
 * Whether an enrollment still grants access, beyond `subscription.status`.
 *
 * A term ends when its batch ends: the batch must be Ongoing and its end date
 * not yet passed. A course pulled back to Draft (or archived / trashed) is off
 * the air for everyone, including students who bought it. Both rules are
 * applied wherever owned content is listed or played, so a batch nobody
 * remembered to close can no longer keep videos alive.
 */
export function batchIsLive(
  batch?: Pick<BatchDoc, "status" | "endDate"> | null,
  now = new Date(),
) {
  if (!batch || batch.status !== "Ongoing") return false;
  const end = asDate(batch.endDate);
  return !end || now <= end;
}

export function courseIsLive(course?: Pick<CourseDoc, "status" | "trashed"> | null) {
  return Boolean(course) && !course!.trashed && isPublished(course);
}

export function accessIsLive(
  course?: Pick<CourseDoc, "status" | "trashed"> | null,
  batch?: Pick<BatchDoc, "status" | "endDate"> | null,
  now = new Date(),
) {
  return courseIsLive(course) && batchIsLive(batch, now);
}
