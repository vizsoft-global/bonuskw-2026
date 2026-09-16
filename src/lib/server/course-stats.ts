import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Counts the students enrolled on a course and stamps it on the course doc.
 *
 * The card used to show `bookedCount`, a counter the legacy Flutter admin
 * incremented — it reached ~10,000 per course against a platform of ~3,900
 * students, which also made 251 limited courses read as sold out. Counting the
 * `subscription` rows again is idempotent, so a repeat or a missed call cannot
 * corrupt the figure the way an increment can.
 *
 * Test enrolments (dev-mode testers) are not students and are left out.
 * Kept in step with `bonuskw-admin/src/lib/server/course-stats.ts`, which
 * recounts from the same rows after a paid enrolment.
 */
export async function recountCourseStudents(courseId: string): Promise<number> {
  const db = getAdminDb();
  const courseRef = db.collection(collections.course).doc(courseId);
  const snap = await db
    .collection(collections.subscription)
    .where("courseRef", "==", courseRef)
    .select("userRef", "isTest")
    .get();
  const students = new Set<string>();
  for (const row of snap.docs) {
    if (row.get("isTest") === true) continue;
    const id = (row.get("userRef") as { id?: string } | undefined)?.id;
    if (id) students.add(id);
  }
  await courseRef.update({ studentCount: students.size });
  return students.size;
}

/** Legacy counter the Flutter app still reads; kept so its behaviour is unchanged. */
export function legacyBookedIncrement() {
  return { bookedCount: FieldValue.increment(1) };
}
