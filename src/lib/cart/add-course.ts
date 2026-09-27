import { collection, doc, getDocs, query, where, type DocumentReference } from "firebase/firestore";
import { showAddedToCart } from "@/components/cart/added-dialog";
import { getBatch } from "@/lib/catalog/queries";
import { loadLiveSubscription } from "@/lib/course/enrollments";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
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

/** The student already has this course or eBook, or it is already in the cart. */
export class AlreadyOwnedError extends Error {
  reason: "enrolled" | "inCart";
  constructor(reason: "enrolled" | "inCart") {
    super(`Already ${reason}`);
    this.name = "AlreadyOwnedError";
    this.reason = reason;
  }
}

/** Translated reason for a refused add-to-cart; generic text for anything else. */
export function enrolmentClosedMessage(
  err: unknown,
  t: (key: "batchFull" | "enrolmentClosedToast" | "draft" | "ownEnrolledLong" | "ownInCartLong") => string,
): string {
  if (err instanceof AlreadyOwnedError) return t(err.reason === "enrolled" ? "ownEnrolledLong" : "ownInCartLong");
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
  { announce = true }: { announce?: boolean } = {},
) {
  const ebook = isEbookCourse(course);
  const kind = ebook ? "ebook" : "course";
  const cart = await loadCart(uid);
  if (cart.lines.some((line) => line.kind === kind && line.courseId === course.id)) {
    throw new AlreadyOwnedError("inCart");
  }
  if (ebook ? await ownsEbook(uid, course.id) : await loadLiveSubscription(uid, course.id)) {
    throw new AlreadyOwnedError("enrolled");
  }
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
    kind,
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

  await saveCart(uid, upsertLine(cart, line));
  if (announce) showAddedToCart({ title: course.name, image: line.image });
}

/** eBook ids the student has bought (`ebookAccess` rows still Ongoing). */
export async function loadOwnedEbookIds(uid: string) {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, collections.ebookAccess), where("userRef", "==", doc(db, collections.users, uid))),
  );
  return snap.docs.filter((d) => d.get("status") === "Ongoing").map((d) => (d.get("courseRef") as DocumentReference).id);
}

async function ownsEbook(uid: string, courseId: string) {
  return (await loadOwnedEbookIds(uid)).includes(courseId);
}
