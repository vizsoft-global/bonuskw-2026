/**
 * The one-line EMI teaser for a course or cart line.
 *
 * An uneven plan cannot be summarised as "first installment × count": a 50 KWD
 * course sold as 20 / 15 / 15 read as "20 x 3 months", which looks like 60 KWD
 * and is what made the checkout look wrong. Uneven plans list their actual
 * schedule instead; even ones keep the familiar "20 x 3 months".
 */
export function emiLabel(
  plan: number[],
  labels: { months: string; schedule: string },
  format: (value: number) => string,
): string | null {
  if (plan.length < 2) return null;
  const first = Number(plan[0]);
  // A split that only differs by rounding (a few fils on the last installment)
  // is still an even plan, and "26.666 x 3 months" reads better than listing it.
  const even = plan.every((v) => Math.abs(Number(v) - first) <= 0.05);
  if (even) {
    return labels.months.replace("{amount}", format(first)).replace("{n}", String(plan.length));
  }
  return labels.schedule
    .replace("{schedule}", plan.map((v) => format(Number(v))).join(" + "))
    .replace("{n}", String(plan.length));
}
