import { getBatch } from "@/lib/catalog/queries";
import { loadCart, saveCart, upsertLine, type CartLine, type CartPaymentType } from "@/lib/cart/store";
import { enrolmentBlock, type EnrolBlock } from "@/lib/course/enrol";
import { courseEmiAmounts, courseEmiCount, splitEmi } from "@/lib/course/emi";
import { courseThumb } from "@/lib/course/thumb";
import { isEbookCourse } from "@/lib/format";
import type { CourseDoc } from "@/lib/types/firestore";

/** Thrown when the course cannot be sold right now (no live batch, full, draft). */
export class EnrolmentClosedError extends Error {
  reason: Exclude<EnrolBlock, null>;
  constructor(reason: Exclude<EnrolBlock, null>) {
    super(`Enrolment closed: ${reason}`);
    this.name = "EnrolmentClosedError";
    this.reason = reason;
  }
}

/** Translated reason for a refused add-to-cart; generic text for anything else. */
export function enrolmentClosedMessage(
  err: unknown,
  t: (key: "batchFull" | "enrolmentClosedToast" | "draft") => string,
): string {
  if (err instanceof EnrolmentClosedError) {
    if (err.reason === "batch-full") return t("batchFull");
    if (err.reason === "draft" || err.reason === "ebook") return t("draft");
    return t("enrolmentClosedToast");
  }
  return t("enrolmentClosedToast");
}

function emiPlan(course: CourseDoc) {
  const count = courseEmiCount(course);
  const stored = courseEmiAmounts(course).slice(0, count);
  if (stored.length === count && stored.every((a) => a > 0)) return stored;
  return splitEmi(Number(course.price) || 0, "even", count);
}

/**
 * The one way a course or eBook gets into the cart. Reads the course's batch
 * and refuses when `enrolmentBlock` says no, so a closed batch is stopped at
 * the "Add to cart" tap instead of surfacing as a checkout error later.
 * eBooks have no batch and are never blocked here.
 */
export async function addCourseLine(
  uid: string,
  course: CourseDoc & { id: string },
  paymentType: CartPaymentType = "Full payment",
) {
  const ebook = isEbookCourse(course);
  let batchName: string | undefined;
  let batchId: string | undefined;
  if (!ebook) {
    const batch = await getBatch(course.batchesRef?.id);
    const reason = enrolmentBlock(course, batch);
    if (reason) throw new EnrolmentClosedError(reason);
    batchName = batch?.name || undefined;
    batchId = course.batchesRef?.id;
  }

  const emi = !ebook && Boolean(course.emiPaymentStatus);
  const line: CartLine = {
    kind: ebook ? "ebook" : "course",
    courseId: course.id,
    paymentType: emi ? paymentType : "Full payment",
    title: course.name,
    image: ebook ? course.image : courseThumb(course),
    price: Number(course.price) || 0,
    addedAt: Date.now(),
    ...(ebook ? {} : { emiAvailable: emi }),
    ...(emi ? { emiCount: courseEmiCount(course), emiAmounts: emiPlan(course) } : {}),
    ...(batchName ? { batch: batchName } : {}),
    ...(batchId ? { batchId } : {}),
  };

  const cart = await loadCart(uid);
  await saveCart(uid, upsertLine(cart, line));
}
