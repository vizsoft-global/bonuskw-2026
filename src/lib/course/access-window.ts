import { asDate } from "@/lib/format";
import type { BatchDoc, CourseDoc } from "@/lib/types/firestore";

/**
 * Whether an enrollment still grants access, beyond `subscription.status`.
 *
 * A term ends when its batch ends: the batch must be Ongoing and its end date
 * not yet passed. Applied wherever owned content is listed or played, so a
 * batch nobody remembered to close cannot keep videos alive until the nightly
 * clean-up archives the enrolments. Publish state does not affect students
 * who already enrolled — only a trashed course goes dark.
 */
export function batchIsLive(
  batch?: Pick<BatchDoc, "status" | "endDate"> | null,
  now = new Date(),
) {
  if (!batch || batch.status !== "Ongoing") return false;
  const end = asDate(batch.endDate);
  return !end || now <= end;
}

export function courseIsLive(course?: Pick<CourseDoc, "trashed"> | null) {
  return Boolean(course) && !course!.trashed;
}

export function accessIsLive(
  course?: Pick<CourseDoc, "trashed"> | null,
  batch?: Pick<BatchDoc, "status" | "endDate"> | null,
  now = new Date(),
) {
  return courseIsLive(course) && batchIsLive(batch, now);
}
