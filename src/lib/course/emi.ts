/**
 * Courses sold on installments carry a fixed plan chosen by the admin:
 * `emiCount` (2–6) and `emiAmounts` (one entry per installment). The legacy
 * student app only understands three, so the first three amounts are mirrored
 * into `firstEMIprice`/`secondEMIprice`/`thirdEMIprice`, chapters keep
 * `emiType` First/Second/Third alongside the new `emiIndex`, and subscriptions
 * keep `first|second|thirdPaymentStatus` next to `paidCount`.
 */

/** Default and legacy installment count. */
export const EMI_COUNT = 3;
export const MIN_EMI_COUNT = 2;
export const MAX_EMI_COUNT = 6;

/** KWD carries three decimals, so split in fils and convert back. */
const SCALE = 1000;

export type EmiSplitMode = "even" | "nice" | "frontload" | "backload" | "custom";

export function clampEmiCount(value: unknown): number {
  const n = Math.round(Number(value) || 0);
  if (!Number.isFinite(n) || n < MIN_EMI_COUNT) return EMI_COUNT;
  return Math.min(MAX_EMI_COUNT, n);
}

/**
 * Half a power of ten of the per-installment share, floored to at least 1 KWD.
 * Returns null when the share is below 3 KWD so callers fall back to `nice`.
 */
function niceStep(shareFils: number): number | null {
  const shareKwd = shareFils / SCALE;
  if (shareKwd < 3) return null;
  const power = 10 ** Math.floor(Math.log10(shareKwd));
  const stepKwd = Math.max(1, power / 2);
  return Math.round(stepKwd * SCALE);
}

function fromFils(parts: number[]): number[] {
  return parts.map((p) => p / SCALE);
}

/** `count - 1` copies of `part`, remainder on the last installment. */
function tail(total: number, part: number, count: number) {
  return fromFils([...Array(count - 1).fill(part), total - part * (count - 1)]);
}

/**
 * Divides a price into `count` installments. All arithmetic is in fils so the
 * parts always sum back to exactly the full price. `custom` is not a split
 * algorithm — callers keep the manually edited amounts.
 */
export function splitEmi(
  price: number,
  mode: Exclude<EmiSplitMode, "custom"> = "even",
  count: number = EMI_COUNT,
): number[] {
  const n = clampEmiCount(count);
  const total = Math.round((Number(price) || 0) * SCALE);
  if (total <= 0) return Array(n).fill(0);

  const share = total / n;
  switch (mode) {
    case "even":
      return tail(total, Math.floor(share), n);
    case "nice":
      return tail(total, Math.floor(share / SCALE) * SCALE, n);
    case "backload": {
      const step = niceStep(share);
      const part = step == null ? Math.floor(share / SCALE) * SCALE : Math.floor(share / step) * step;
      return tail(total, part, n);
    }
    case "frontload": {
      const step = niceStep(share);
      const small = step == null ? Math.floor(share / SCALE) * SCALE : Math.floor(share / step) * step;
      return fromFils([total - small * (n - 1), ...Array(n - 1).fill(small)]);
    }
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/** Legacy three-price fields plus the new plan fields, as stored on a course. */
export type EmiAmounts = {
  firstEMIprice?: number;
  secondEMIprice?: number;
  thirdEMIprice?: number;
  emiCount?: number;
  emiAmounts?: number[];
};

/**
 * The installment amounts a course sells with. Prefers `emiAmounts`; falls back
 * to the three legacy prices for courses saved before plans were configurable.
 */
export function courseEmiAmounts(course: EmiAmounts): number[] {
  if (Array.isArray(course.emiAmounts) && course.emiAmounts.length >= MIN_EMI_COUNT) {
    return course.emiAmounts.map((v) => Number(v) || 0);
  }
  return [course.firstEMIprice, course.secondEMIprice, course.thirdEMIprice].map(
    (v) => Number(v) || 0,
  );
}

export function courseEmiCount(course: EmiAmounts): number {
  if (course.emiCount) return clampEmiCount(course.emiCount);
  if (Array.isArray(course.emiAmounts) && course.emiAmounts.length >= MIN_EMI_COUNT) {
    return clampEmiCount(course.emiAmounts.length);
  }
  return EMI_COUNT;
}

/** Legacy mirror: the first three amounts, padded with 0 for shorter plans. */
export function legacyEmiPrices(amounts: number[]) {
  return {
    firstEMIprice: amounts[0] ?? 0,
    secondEMIprice: amounts[1] ?? 0,
    thirdEMIprice: amounts[2] ?? 0,
  };
}

export function emiTotal(amounts: EmiAmounts | number[]) {
  const list = Array.isArray(amounts) ? amounts : courseEmiAmounts(amounts);
  const sum = list.reduce((s, v) => s + Math.round((Number(v) || 0) * SCALE), 0);
  return sum / SCALE;
}

/**
 * The old admin refused to save when the installments summed to less than the
 * full price, which stops a course being sold for less on EMI than up front.
 * Charging a premium for paying over time is allowed.
 */
export function validateEmi(price: number, amounts: EmiAmounts | number[]): string | null {
  const list = Array.isArray(amounts) ? amounts : courseEmiAmounts(amounts);
  if (list.some((v) => !(Number(v) > 0))) return "Enter an amount for each installment.";
  const total = emiTotal(list);
  if (Math.round(total * SCALE) < Math.round((Number(price) || 0) * SCALE)) {
    return "The installments must add up to at least the full price.";
  }
  return null;
}

export const EMI_TRANCHES = ["First", "Second", "Third"] as const;
export type EmiTranche = (typeof EMI_TRANCHES)[number];

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"] as const;

/** "First" … "Sixth" for 1-based installment indexes. */
export function emiOrdinal(index: number) {
  return ORDINALS[Math.min(Math.max(index, 1), MAX_EMI_COUNT) - 1];
}

/** Legacy `emiType` for a 1-based index; indexes beyond three have none. */
export function emiTypeForIndex(index: number): EmiTranche | null {
  return index >= 1 && index <= 3 ? EMI_TRANCHES[index - 1] : null;
}

export function emiIndexForType(value?: string | null): number {
  const tranche = normalizeEmiTranche(value);
  return EMI_TRANCHES.indexOf(tranche) + 1;
}

/**
 * The auto-translate job overwrote `emiType` on some chapters with the Arabic
 * word, which matches no gate in the student app. Normalise on read so those
 * chapters behave correctly even before the data is repaired.
 */
const ARABIC_TRANCHE: Record<string, EmiTranche> = {
  "أولا": "First",
  "أولاً": "First",
  "اولا": "First",
  "اولاً": "First",
  "الأول": "First",
  "ثانيا": "Second",
  "ثانياً": "Second",
  "ثانيًا": "Second",
  "الثاني": "Second",
  "ثالثا": "Third",
  "ثالثاً": "Third",
  "ثالثًا": "Third",
  "الثالث": "Third",
};

export function normalizeEmiTranche(value?: string | null): EmiTranche {
  if (!value) return "First";
  const trimmed = value.trim();
  if ((EMI_TRANCHES as readonly string[]).includes(trimmed)) return trimmed as EmiTranche;
  return ARABIC_TRANCHE[trimmed] ?? "First";
}

/** True when the stored value is neither a valid tranche nor a known translation. */
export function isUnknownTranche(value?: string | null) {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    !(EMI_TRANCHES as readonly string[]).includes(trimmed) && !(trimmed in ARABIC_TRANCHE)
  );
}

/**
 * Installments captured on a subscription. Prefers `paidCount`; legacy EMI
 * subscriptions are read from the three status fields, and a captured full
 * payment counts as the whole plan.
 */
export function subscriptionPaidCount(sub: {
  paymentType?: string;
  payment_status?: string;
  paidCount?: number;
  installmentCount?: number;
  firstPaymentStatus?: string;
  secondPaymentStatus?: string;
  thirdPaymentStatus?: string;
}): number {
  if (sub.paymentType !== "EMI") {
    return sub.payment_status === "CAPTURED" ? (sub.installmentCount ?? 1) : 0;
  }
  if (typeof sub.paidCount === "number") return sub.paidCount;
  let paid = 0;
  if (sub.firstPaymentStatus === "CAPTURED") paid = 1;
  if (paid === 1 && sub.secondPaymentStatus === "CAPTURED") paid = 2;
  if (paid === 2 && sub.thirdPaymentStatus === "CAPTURED") paid = 3;
  return paid;
}

/**
 * Which installment a chapter unlocks at. Prefers `emiIndex`, then the legacy
 * `emiType`, then 1 (available from the first payment).
 */
export function chapterEmiIndex(chapter: { emiIndex?: number; emiType?: string | null }): number {
  if (chapter.emiIndex && chapter.emiIndex >= 1) return Math.min(chapter.emiIndex, MAX_EMI_COUNT);
  return emiIndexForType(chapter.emiType);
}
