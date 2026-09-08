/**
 * Courses sold on installments are always split into exactly three. The student
 * app depends on that: the course carries `firstEMIprice`/`secondEMIprice`/
 * `thirdEMIprice`, each chapter is tagged `emiType` First/Second/Third, and each
 * subscription tracks `first|second|thirdPaymentStatus`. Changing the count
 * would need a migration on all three, so the admin keeps it fixed at three.
 */

export const EMI_COUNT = 3;

/** KWD carries three decimals, so split in fils and convert back. */
const SCALE = 1000;

export type EmiSplitMode = "even" | "nice" | "frontload" | "backload" | "custom";

/**
 * Half a power of ten of the third, floored to at least 1 KWD.
 * Returns null when the third is below 3 KWD so callers fall back to `nice`.
 * `thirdFils` is the exact (possibly fractional) third of the total in fils.
 */
function niceStep(thirdFils: number): number | null {
  const thirdKwd = thirdFils / SCALE;
  if (thirdKwd < 3) return null;
  const power = 10 ** Math.floor(Math.log10(thirdKwd));
  const stepKwd = Math.max(1, power / 2);
  return Math.round(stepKwd * SCALE);
}

function fromFils(a: number, b: number, c: number): [number, number, number] {
  return [a / SCALE, b / SCALE, c / SCALE];
}

/**
 * Divides a price three ways. All arithmetic is in fils so the three always
 * sum back to exactly the full price. `custom` is not a split algorithm —
 * callers keep the manually edited amounts.
 */
export function splitEmi(
  price: number,
  mode: Exclude<EmiSplitMode, "custom"> = "even",
): [number, number, number] {
  const total = Math.round((Number(price) || 0) * SCALE);
  if (total <= 0) return [0, 0, 0];

  switch (mode) {
    case "even": {
      const part = Math.floor(total / EMI_COUNT);
      return fromFils(part, part, total - part * (EMI_COUNT - 1));
    }
    case "nice": {
      const part = Math.floor(total / EMI_COUNT / SCALE) * SCALE;
      return fromFils(part, part, total - part * (EMI_COUNT - 1));
    }
    case "backload": {
      const third = total / EMI_COUNT;
      const step = niceStep(third);
      if (step == null) {
        const part = Math.floor(total / EMI_COUNT / SCALE) * SCALE;
        return fromFils(part, part, total - part * (EMI_COUNT - 1));
      }
      const part = Math.floor(third / step) * step;
      return fromFils(part, part, total - part * (EMI_COUNT - 1));
    }
    case "frontload": {
      const third = total / EMI_COUNT;
      const step = niceStep(third);
      if (step == null) {
        const part = Math.floor(total / EMI_COUNT / SCALE) * SCALE;
        return fromFils(part, part, total - part * (EMI_COUNT - 1));
      }
      const small = Math.floor(third / step) * step;
      return fromFils(total - small * (EMI_COUNT - 1), small, small);
    }
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export type EmiAmounts = {
  firstEMIprice?: number;
  secondEMIprice?: number;
  thirdEMIprice?: number;
};

export function emiTotal(amounts: EmiAmounts) {
  const sum =
    Math.round((Number(amounts.firstEMIprice) || 0) * SCALE) +
    Math.round((Number(amounts.secondEMIprice) || 0) * SCALE) +
    Math.round((Number(amounts.thirdEMIprice) || 0) * SCALE);
  return sum / SCALE;
}

/**
 * The old admin refused to save when the installments summed to less than the
 * full price, which stops a course being sold for less on EMI than up front.
 * Charging a premium for paying over time is allowed.
 */
export function validateEmi(price: number, amounts: EmiAmounts): string | null {
  const total = emiTotal(amounts);
  if (total <= 0) return "Enter an amount for each installment.";
  if (Math.round(total * SCALE) < Math.round((Number(price) || 0) * SCALE)) {
    return "The three installments must add up to at least the full price.";
  }
  return null;
}

export const EMI_TRANCHES = ["First", "Second", "Third"] as const;
export type EmiTranche = (typeof EMI_TRANCHES)[number];

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
