import type { ChapterDoc, LessonDoc, QuizDoc } from "@/lib/types/firestore";

/**
 * Chapters and lessons store their lock with opposite polarity, and the student
 * app reads both. Getting either backwards silently exposes paid content or
 * hides content people have paid for, so nothing outside this file should read
 * `chapter.status` or `lesson.lesson_lock_status` directly.
 *
 *   chapter.status            true  => unlocked
 *   quiz.status               true  => unlocked (same as chapter)
 *   lesson.lesson_lock_status true  => locked
 *   lesson.lessonStatus       string, and means free preview, not access
 */

/** A chapter with no `status` set is treated as unlocked, matching the old admin. */
export function isChapterLocked(chapter?: Pick<ChapterDoc, "status"> | null) {
  return chapter?.status === false;
}

export function chapterLockUpdate(locked: boolean) {
  return { status: !locked };
}

export function isQuizLocked(quiz?: Pick<QuizDoc, "status"> | null) {
  return quiz?.status === false;
}

export function quizLockUpdate(locked: boolean) {
  return { status: !locked };
}

export function isLessonLocked(lesson?: Pick<LessonDoc, "lesson_lock_status"> | null) {
  return lesson?.lesson_lock_status === true;
}

export function lessonLockUpdate(locked: boolean) {
  return { lesson_lock_status: locked };
}

/**
 * Free preview is a separate concept from the lock, stored as the strings
 * "Unlock" (preview allowed) and "Lock" (not previewable).
 */
export function isFreePreview(lesson?: Pick<LessonDoc, "lessonStatus"> | null) {
  return lesson?.lessonStatus === "Unlock";
}

export function freePreviewUpdate(enabled: boolean) {
  return { lessonStatus: enabled ? "Unlock" : "Lock" };
}

/** A lesson is only reachable when neither it nor its chapter is locked. */
export function isLessonReachable(
  lesson?: Pick<LessonDoc, "lesson_lock_status"> | null,
  chapter?: Pick<ChapterDoc, "status"> | null,
) {
  return !isChapterLocked(chapter) && !isLessonLocked(lesson);
}
