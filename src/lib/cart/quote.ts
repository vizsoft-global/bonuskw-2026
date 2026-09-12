import type { CartLine } from "@/lib/cart/store";
import type { MessageKey } from "@/lib/i18n/messages";

/** One priced line from `/api/checkout/quote` (refs are Firestore paths). */
export type QuoteLine = {
  kind: string;
  courseRef: string;
  chapterRef?: string | null;
  installmentRef?: string | null;
  paymentType?: string;
  listPrice: number;
  originalPrice?: number;
  /** Total discount on this line (promotions + coupon). */
  discount: number;
  promotionDiscount?: number;
  /** Coupon share of `discount`; the server puts the coupon on one line only. */
  couponDiscount?: number;
  amountTotal: number;
  amountNow: number;
  installments?: number[] | null;
  courseName?: string | null;
  owned?: boolean;
};

export type Quote = {
  dueNow?: number;
  couponDiscount?: number;
  couponCode?: string | null;
  promotionDiscount?: number;
  savings?: number;
  suggestions?: Array<{
    promotionId?: string;
    message?: { en?: string; ar?: string } | string | null;
    addCourseIds?: string[];
    potentialSaving?: number;
  }>;
  lines?: QuoteLine[];
  error?: string | null;
};

/**
 * The pricing API answers with short English reasons. Map the known ones to
 * translated copy; anything unknown falls back to a generic message.
 */
export function quoteErrorKey(raw: string | null | undefined): MessageKey {
  const m = (raw || "").toLowerCase();
  if (m.includes("not open for enrolment")) return "courseNotOpen";
  if (m.includes("outside coupon range")) return "couponRange";
  if (m.startsWith("coupon")) {
    if (m.includes("not found")) return "couponNotFound";
    if (m.includes("expired")) return "couponExpired";
    if (m.includes("not yet active")) return "couponNotActive";
    if (m.includes("already used")) return "couponUsed";
    if (m.includes("usage exceeded")) return "couponLimit";
    if (m.includes("not eligible")) return "couponNotEligible";
  }
  return "quoteFailed";
}

/** Promotion hints come back as `{ en, ar }`; pick the viewer's language. */
export function suggestionText(
  message: { en?: string; ar?: string } | string | null | undefined,
  locale: "en" | "ar",
): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  return (locale === "ar" ? message.ar : undefined) || message.en || "";
}

/** Match a quoted line back to the cart line it was priced from. */
export function quoteLineFor(quote: Quote | null, line: CartLine): QuoteLine | undefined {
  return quote?.lines?.find((q) => {
    if (q.kind !== line.kind) return false;
    if (!q.courseRef.endsWith(`/${line.courseId}`)) return false;
    if (line.kind === "chapter") {
      return Boolean(line.chapterId) && Boolean(q.chapterRef?.endsWith(`/${line.chapterId}`));
    }
    if (line.kind === "installment") {
      return (
        Boolean(line.installmentId) &&
        Boolean(q.installmentRef?.endsWith(`/${line.installmentId}`))
      );
    }
    return true;
  });
}
