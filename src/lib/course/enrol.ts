import { asDate } from "@/lib/format";
import { isEbookCourse } from "@/lib/format";
import { isPublished } from "@/lib/course/status";
import type { BatchDoc, CourseDoc } from "@/lib/types/firestore";

export type EnrolBlock =
  | "draft"
  | "no-batch"
  | "batch-closed"
  | "batch-full"
  | "ebook"
  | null;

export function enrolmentBlock(
  course?: Pick<
    CourseDoc,
    | "status"
    | "batchesRef"
    | "bookingLimit"
    | "bookedCount"
    | "itemType"
    | "trashed"
  > | null,
  batch?: Pick<BatchDoc, "status" | "startDate" | "endDate" | "bookingLimit"> | null,
  now = new Date(),
): EnrolBlock {
  if (!course || course.trashed || isEbookCourse(course) || !isPublished(course)) {
    return course && isEbookCourse(course) ? "ebook" : "draft";
  }
  if (!course.batchesRef) return "no-batch";
  if (!batch || batch.status !== "Ongoing") return "no-batch";
  const start = asDate(batch.startDate);
  const end = asDate(batch.endDate);
  if (start && now < start) return "batch-closed";
  if (end && now > end) return "batch-closed";
  const limit = batch.bookingLimit || course.bookingLimit || 0;
  const booked = course.bookedCount ?? 0;
  if (limit > 0 && booked >= limit) return "batch-full";
  return null;
}

export function canEnrol(
  course?: Parameters<typeof enrolmentBlock>[0],
  batch?: Parameters<typeof enrolmentBlock>[1],
) {
  return enrolmentBlock(course, batch) === null;
}
