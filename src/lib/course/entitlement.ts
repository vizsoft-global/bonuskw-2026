import { chapterEmiIndex, emiIndexForType } from "@/lib/course/emi";
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
  | "paidCount"
  | "installmentCount"
> | null;

/** How many installments this subscription has captured. */
export function paidInstallments(sub: Sub): number {
  if (!sub || sub.status !== "Ongoing") return 0;
  if (sub.paymentType !== "EMI") return sub.payment_status === CAPTURED ? Number.MAX_SAFE_INTEGER : 0;
  if (typeof sub.paidCount === "number") return sub.paidCount;
  // Legacy three-field subscriptions.
  let paid = 0;
  if (sub.firstPaymentStatus === CAPTURED) paid = 1;
  if (paid === 1 && sub.secondPaymentStatus === CAPTURED) paid = 2;
  if (paid === 2 && sub.thirdPaymentStatus === CAPTURED) paid = 3;
  return paid;
}

function installmentPaid(sub: Sub, index: number) {
  return paidInstallments(sub) >= index;
}

type ChapterGate = Pick<ChapterDoc, "status" | "emiType" | "emiIndex" | "sellable" | "price">;

function gateIndex(chapter?: Partial<ChapterGate> | null) {
  if (!chapter) return 1;
  if (chapter.emiIndex) return chapterEmiIndex(chapter);
  return emiIndexForType(chapter.emiType);
}

export function lessonAccess(input: {
  lesson?: Pick<LessonDoc, "lesson_lock_status" | "lessonStatus"> | null;
  chapter?: Partial<ChapterGate> | null;
  subscription?: Sub;
  chapterPurchased?: boolean;
}): AccessState {
  const { lesson, chapter, subscription, chapterPurchased } = input;
  if (isFreePreview(lesson) && isLessonReachable(lesson, chapter)) return "preview";
  if (chapterPurchased && isLessonReachable(lesson, chapter)) return "open";
  if (subscription?.status === "Ongoing") {
    if (installmentPaid(subscription, gateIndex(chapter)) && isLessonReachable(lesson, chapter)) {
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
  chapter?: Partial<Pick<ChapterDoc, "status" | "emiType" | "emiIndex">> | null;
  subscription?: Sub;
  chapterPurchased?: boolean;
}) {
  if (isQuizLocked(input.quiz) || isChapterLocked(input.chapter)) return "locked" as const;
  if (input.chapterPurchased) return "open" as const;
  if (input.subscription?.status === "Ongoing") {
    if (installmentPaid(input.subscription, gateIndex(input.chapter))) return "open" as const;
  }
  return "locked" as const;
}
