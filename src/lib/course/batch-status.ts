import { asDate } from "@/lib/format";
import type { BatchDoc } from "@/lib/types/firestore";

/**
 * How a batch should read at a glance:
 * - `active`   → Ongoing and inside its dates: students can enrol.
 * - `upcoming` → Ongoing but the start date is still ahead.
 * - `closed`   → Archived/other status, or the end date has passed.
 *
 * Mirrors `enrolmentBlock` so a green chip always means "Add to cart" works.
 */
export type BatchTone = "active" | "upcoming" | "closed";

export function batchTone(
  batch?: Pick<BatchDoc, "status" | "startDate" | "endDate"> | null,
  now = new Date(),
): BatchTone {
  if (!batch || batch.status !== "Ongoing") return "closed";
  const start = asDate(batch.startDate);
  const end = asDate(batch.endDate);
  if (end && now > end) return "closed";
  if (start && now < start) return "upcoming";
  return "active";
}

/** Batch name + tone, the shape every list/card needs. */
export type BatchInfo = { name: string; tone: BatchTone };

export function batchInfo(batch?: (Pick<BatchDoc, "status" | "startDate" | "endDate"> & { name?: unknown }) | null): BatchInfo {
  return {
    name: typeof batch?.name === "string" ? batch.name : "",
    tone: batchTone(batch),
  };
}

/** Tailwind classes for the small chips (thumbnail badge, cart line, hero). */
export const BATCH_TONE_CLASS: Record<BatchTone, string> = {
  active: "border-[#1f9d4d] bg-[#1f9d4d] text-white",
  upcoming: "border-[#d9a441] bg-[#b7791f] text-white",
  closed: "border-[#f24822] bg-[#c0392b] text-white",
};
