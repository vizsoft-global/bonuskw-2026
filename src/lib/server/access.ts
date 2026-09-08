import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { collections } from "@/lib/firebase/collections";
import { lessonAccess, quizAccess } from "@/lib/course/entitlement";
import type {
  ChapterDoc,
  ChapterAccessDoc,
  LessonDoc,
  QuizDoc,
  SubscriptionDoc,
} from "@/lib/types/firestore";

const CAPTURED = "CAPTURED";

export async function loadAccess(db: Firestore, uid: string, courseId: string) {
  const userRef = db.collection(collections.users).doc(uid);
  const courseRef = db.collection(collections.course).doc(courseId);
  const [subs, chapters] = await Promise.all([
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
  const subscription =
    subs.docs
      .map((d) => d.data() as SubscriptionDoc)
      .find((s) => s.status === "Ongoing") ?? null;
  const purchased = new Set(
    chapters.docs
      .filter((d) => {
        const data = d.data() as ChapterAccessDoc;
        return data.status === "Ongoing" && data.payment_status === CAPTURED;
      })
      .map((d) => d.get("chapterRef")?.id)
      .filter(Boolean),
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
