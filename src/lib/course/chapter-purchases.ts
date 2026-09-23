import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { accessIsLive } from "@/lib/course/access-window";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { BatchDoc, ChapterAccessDoc, CourseDoc } from "@/lib/types/firestore";

const CAPTURED = "CAPTURED";

/**
 * Chapters this student bought one at a time, which is a `chapterAccess` row
 * and not a `subscription`.
 *
 * The client-side twin of the server's `loadAccess`, and it exists for the same
 * reason: without it nothing on the student side knew a chapter had been paid
 * for, so `buildOutline` locked every lesson in it and the course page kept
 * offering to sell the chapter again — while the player itself would have
 * allowed playback. The conditions are deliberately identical to the server's,
 * so a chapter never looks open in the UI and then refuses to play:
 * Ongoing + captured, in a batch that is still running.
 */
export async function loadPurchasedChapterIds(
  uid: string,
  courseId: string,
  now = new Date(),
): Promise<Set<string>> {
  const db = getDb();
  const courseRef = doc(db, collections.course, courseId);
  const [courseSnap, rows] = await Promise.all([
    getDoc(courseRef),
    getDocs(
      query(
        collection(db, collections.chapterAccess),
        where("userRef", "==", doc(db, collections.users, uid)),
        where("courseRef", "==", courseRef),
      ),
    ),
  ]);
  const course = courseSnap.exists() ? (courseSnap.data() as CourseDoc) : null;
  if (!course) return new Set<string>();

  const paid = rows.docs
    .map((d) => d.data() as ChapterAccessDoc)
    .filter((row) => row.status === "Ongoing" && row.payment_status === CAPTURED && row.chapterRef?.id);

  // The row's own batch decides the term; rows written before `batchesRef`
  // fall back to the course's current batch, as they do on the server.
  const batchRefOf = (row: ChapterAccessDoc) => row.batchesRef ?? course.batchesRef;
  const batchIds = [
    ...new Set(paid.map((row) => batchRefOf(row)?.id).filter((id): id is string => Boolean(id))),
  ];
  const batchSnaps = await Promise.all(
    batchIds.map((batchId) => getDoc(doc(db, collections.batches, batchId))),
  );
  const batches = new Map(batchSnaps.map((s) => [s.id, s.exists() ? (s.data() as BatchDoc) : null]));

  const purchased = new Set<string>();
  for (const row of paid) {
    const batchRef = batchRefOf(row);
    const batch = batchRef ? batches.get(batchRef.id) ?? null : null;
    if (!accessIsLive(course, batch, now)) continue;
    purchased.add(row.chapterRef!.id);
  }
  return purchased;
}
