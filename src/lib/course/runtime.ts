import { runtimeParts } from "@/lib/format";

/**
 * The runtime a course card shows: "2 Hrs" above an hour, "14 Min" below it, or
 * undefined when the course has no video runtime at all — in which case the card
 * shows no runtime rather than a made-up figure.
 */
export function courseRuntimeLabel(
  seconds: number | undefined,
  unit: { hours: string; minutes: string },
): string | undefined {
  const parts = runtimeParts(Number(seconds || 0));
  if (!parts) return undefined;
  return `${parts.amount} ${parts.unit === "hours" ? unit.hours : unit.minutes}`;
}
