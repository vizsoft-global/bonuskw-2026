import { collection, doc, getDoc, getDocs, query, where, type DocumentReference } from "firebase/firestore";
import { accessIsLive } from "@/lib/course/access-window";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { BatchDoc, CourseDoc, SubscriptionDoc } from "@/lib/types/firestore";

export type LiveEnrollment = {
  id: string;
  courseId: string;
  batchId: string | null;
  subscription: SubscriptionDoc;
};

async function loadMany<T>(col: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const snaps = await Promise.all(unique.map((id) => getDoc(doc(getDb(), col, id))));
  return new Map(snaps.map((s) => [s.id, s.exists() ? (s.data() as T) : null]));
}

/**
 * The student's enrollments that still grant access: subscription Ongoing,
 * course published, and the batch it was bought in still running. Home and My
 * Space list from this so a finished term or a drafted course disappears the
 * moment it ends, whether or not anyone closed the batch by hand.
 */
export async function loadLiveEnrollments(uid: string, now = new Date()): Promise<LiveEnrollment[]> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, collections.subscription), where("userRef", "==", doc(db, collections.users, uid))),
  );
  const ongoing = snap.docs
    .map((d) => ({ id: d.id, data: d.data() as SubscriptionDoc }))
    .filter((s) => s.data.status === "Ongoing" && s.data.courseRef?.id);

  const courses = await loadMany<CourseDoc>(
    collections.course,
    ongoing.map((s) => s.data.courseRef!.id),
  );
  const batchRefOf = (s: { data: SubscriptionDoc }): DocumentReference | undefined =>
    s.data.batchesRef ?? courses.get(s.data.courseRef!.id)?.batchesRef;
  const batches = await loadMany<BatchDoc>(
    collections.batches,
    ongoing.map((s) => batchRefOf(s)?.id).filter((id): id is string => Boolean(id)),
  );

  const seen = new Set<string>();
  const live: LiveEnrollment[] = [];
  for (const s of ongoing) {
    const courseId = s.data.courseRef!.id;
    if (seen.has(courseId)) continue;
    const batchRef = batchRefOf(s);
    const course = courses.get(courseId) ?? null;
    const batch = batchRef ? batches.get(batchRef.id) ?? null : null;
    if (!accessIsLive(course, batch, now)) continue;
    seen.add(courseId);
    live.push({ id: s.id, courseId, batchId: batchRef?.id ?? null, subscription: s.data });
  }
  return live;
}

/** Live enrollment in one course, or null. Same rules as `loadLiveEnrollments`. */
export async function loadLiveSubscription(uid: string, courseId: string, now = new Date()) {
  const db = getDb();
  const courseRef = doc(db, collections.course, courseId);
  const [courseSnap, subs] = await Promise.all([
    getDoc(courseRef),
    getDocs(
      query(
        collection(db, collections.subscription),
        where("userRef", "==", doc(db, collections.users, uid)),
        where("courseRef", "==", courseRef),
        where("status", "==", "Ongoing"),
      ),
    ),
  ]);
  const course = courseSnap.exists() ? (courseSnap.data() as CourseDoc) : null;
  if (!course) return null;
  for (const d of subs.docs) {
    const data = d.data() as SubscriptionDoc;
    const batchRef = data.batchesRef ?? course.batchesRef;
    const batchSnap = batchRef ? await getDoc(batchRef) : null;
    const batch = batchSnap?.exists() ? (batchSnap.data() as BatchDoc) : null;
    if (accessIsLive(course, batch, now)) {
      return { id: d.id, ...data } as SubscriptionDoc & { id: string };
    }
  }
  return null;
}
