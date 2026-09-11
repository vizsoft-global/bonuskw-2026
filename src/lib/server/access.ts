import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { collections } from "@/lib/firebase/collections";
import { accessIsLive, courseIsLive } from "@/lib/course/access-window";
import { lessonAccess, quizAccess } from "@/lib/course/entitlement";
import type {
  BatchDoc,
  ChapterDoc,
  ChapterAccessDoc,
  CourseDoc,
  LessonDoc,
  QuizDoc,
  SubscriptionDoc,
} from "@/lib/types/firestore";

const CAPTURED = "CAPTURED";

/** Doc types are declared with the client SDK's reference class; only `id` is needed here. */
type RefLike = { id: string };

/**
 * Loads the batches an enrollment points at, so a term that has ended (or a
 * batch someone forgot to close) stops granting access even though the
 * subscription row still says Ongoing.
 */
async function loadBatches(db: Firestore, refs: Array<RefLike | undefined>) {
  const ids = [...new Set(refs.map((r) => r?.id).filter((id): id is string => Boolean(id)))];
  const snaps = await Promise.all(ids.map((id) => db.collection(collections.batches).doc(id).get()));
  return new Map(snaps.map((s) => [s.id, s.exists ? (s.data() as BatchDoc) : null]));
}

export async function loadAccess(db: Firestore, uid: string, courseId: string) {
  const userRef = db.collection(collections.users).doc(uid);
  const courseRef = db.collection(collections.course).doc(courseId);
  const [courseSnap, subs, chapters] = await Promise.all([
    courseRef.get(),
    db
      .collection(collections.subscription)
      .where("userRef", "==", userRef)
      .where("courseRef", "==", courseRef)
      .limit(5)
      .get(),
    db
      .collection(collections.chapterAccess)
      .where("userRef", "==", userRef)
      .where("courseRef", "==", courseRef)
      .limit(40)
      .get(),
  ]);
  const course = courseSnap.exists ? (courseSnap.data() as CourseDoc) : null;
  // A trashed course is off the air for everyone.
  if (!courseIsLive(course)) {
    return { subscription: null, purchased: new Set<string>() };
  }

  const ongoingSubs = subs.docs.map((d) => d.data() as SubscriptionDoc).filter((s) => s.status === "Ongoing");
  const paidChapters = chapters.docs
    .map((d) => d.data() as ChapterAccessDoc)
    .filter((c) => c.status === "Ongoing" && c.payment_status === CAPTURED);

  // The enrollment's own batch decides the term; fall back to the course's
  // current batch for legacy rows written without one.
  const batches = await loadBatches(db, [
    ...ongoingSubs.map((s) => s.batchesRef ?? course!.batchesRef),
    ...paidChapters.map((c) => c.batchesRef ?? course!.batchesRef),
  ]);
  const live = (batchRef?: RefLike) => {
    const ref = batchRef ?? course!.batchesRef;
    return accessIsLive(course, ref ? batches.get(ref.id) : null);
  };

  const subscription = ongoingSubs.find((s) => live(s.batchesRef)) ?? null;
  const purchased = new Set(
    paidChapters
      .filter((c) => live(c.batchesRef))
      .map((c) => c.chapterRef?.id)
      .filter((id): id is string => Boolean(id)),
  );
  return { subscription, purchased };
}

export async function canPlayLesson(
  db: Firestore,
  uid: string,
  lessonId: string,
) {
  const lessonSnap = await db.collection(collections.lessons).doc(lessonId).get();
  if (!lessonSnap.exists) return { ok: false as const, error: "Lesson not found" };
  const lesson = lessonSnap.data() as LessonDoc;
  const courseId = lesson.courseRef?.id;
  const chapterId = lesson.chapterRef?.id;
  if (!courseId) return { ok: false as const, error: "Course missing" };
  const chapterSnap = chapterId
    ? await db.collection(collections.chapter).doc(chapterId).get()
    : null;
  const chapter = chapterSnap?.exists ? (chapterSnap.data() as ChapterDoc) : null;
  const access = await loadAccess(db, uid, courseId);
  const state = lessonAccess({
    lesson,
    chapter,
    subscription: access.subscription,
    chapterPurchased: chapterId ? access.purchased.has(chapterId) : false,
  });
  if (state !== "open" && state !== "preview") {
    return { ok: false as const, error: "Locked" };
  }
  return { ok: true as const, lesson, courseId, chapterId };
}

export async function canTakeQuiz(db: Firestore, uid: string, quizId: string) {
  const snap = await db.collection(collections.quiz).doc(quizId).get();
  if (!snap.exists) return false;
  const quiz = snap.data() as QuizDoc;
  const courseId = quiz.courseRef?.id;
  if (!courseId) return false;
  const access = await loadAccess(db, uid, courseId);
  return (
    quizAccess({
      quiz,
      subscription: access.subscription,
      chapterPurchased: false,
    }) === "open"
  );
}
