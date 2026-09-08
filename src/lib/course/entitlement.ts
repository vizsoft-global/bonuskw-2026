import { normalizeEmiTranche, type EmiTranche } from "@/lib/course/emi";
import {
  isChapterLocked,
  isFreePreview,
  isLessonLocked,
  isLessonReachable,
  isQuizLocked,
} from "@/lib/course/locks";
import type { ChapterDoc, LessonDoc, QuizDoc, SubscriptionDoc } from "@/lib/types/firestore";

const CAPTURED = "CAPTURED";

export type AccessState = "open" | "preview" | "locked" | "buy-chapter";

type Sub = Pick<
  SubscriptionDoc,
  | "status"
  | "paymentType"
  | "payment_status"
  | "firstPaymentStatus"
  | "secondPaymentStatus"
  | "thirdPaymentStatus"
> | null;

function tranchePaid(sub: Sub, tranche: EmiTranche) {
  if (!sub || sub.status !== "Ongoing") return false;
  if (sub.paymentType !== "EMI") return sub.payment_status === CAPTURED;
  if (tranche === "First") return sub.firstPaymentStatus === CAPTURED;
  if (tranche === "Second") return sub.secondPaymentStatus === CAPTURED;
  return sub.thirdPaymentStatus === CAPTURED;
}

export function lessonAccess(input: {
  lesson?: Pick<LessonDoc, "lesson_lock_status" | "lessonStatus"> | null;
  chapter?: Pick<ChapterDoc, "status" | "emiType" | "sellable" | "price"> | null;
  subscription?: Sub;
  chapterPurchased?: boolean;
}): AccessState {
  const { lesson, chapter, subscription, chapterPurchased } = input;
  if (isFreePreview(lesson) && isLessonReachable(lesson, chapter)) return "preview";
  if (chapterPurchased && isLessonReachable(lesson, chapter)) return "open";
  if (subscription?.status === "Ongoing") {
    const tranche = normalizeEmiTranche(chapter?.emiType);
    if (tranchePaid(subscription, tranche) && isLessonReachable(lesson, chapter)) {
      return "open";
    }
  }
  if (chapter?.sellable && (isChapterLocked(chapter) || isLessonLocked(lesson))) {
    return "buy-chapter";
  }
  if (!isLessonReachable(lesson, chapter)) return "locked";
  return "locked";
}

export function quizAccess(input: {
  quiz?: Pick<QuizDoc, "status"> | null;
  chapter?: Pick<ChapterDoc, "status" | "emiType"> | null;
  subscription?: Sub;
  chapterPurchased?: boolean;
}) {
  if (isQuizLocked(input.quiz) || isChapterLocked(input.chapter)) return "locked" as const;
  if (input.chapterPurchased) return "open" as const;
  if (input.subscription?.status === "Ongoing") {
    const tranche = normalizeEmiTranche(input.chapter?.emiType);
    if (tranchePaid(input.subscription, tranche)) return "open" as const;
  }
  return "locked" as const;
}
