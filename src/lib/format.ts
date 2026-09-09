import { format, isToday, startOfDay, subDays } from "date-fns";
import type { Timestamp } from "firebase/firestore";

type DateLike = Timestamp | Date | null | undefined | unknown;

/** Firestore reads come back loosely typed, so accept anything and narrow here. */
export function asDate(value?: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const candidate = value as { toDate?: () => Date };
  if (typeof candidate.toDate === "function") return candidate.toDate();
  return null;
}

export function formatDate(value?: DateLike) {
  const d = asDate(value);
  return d ? format(d, "d MMM yyyy") : "—";
}

export function formatDateTime(value?: DateLike) {
  const d = asDate(value);
  return d ? format(d, "d MMM yyyy, HH:mm") : "—";
}

export function formatKwd(amount?: number | null) {
  if (amount == null || Number.isNaN(amount)) return "0 KWD";
  return `${Number(amount).toLocaleString()} KWD`;
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

/** Seconds to `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function displayName(user?: {
  display_name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
} | null) {
  if (!user) return "—";
  if (user.display_name) return user.display_name;
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return combined || user.email || "—";
}

export const EBOOK_ITEM_TYPE = "ebook";

/**
 * eBooks are flagged explicitly. The old heuristic (no lessons and no intro
 * video) misfiled almost every migrated course, since `numberLessons` was
 * rarely maintained and most courses never had a trailer.
 */
export function isEbookCourse(course?: { itemType?: string }) {
  return course?.itemType === EBOOK_ITEM_TYPE;
}

export function ebookPageCount(course?: { numberLessons?: number; ebookFiles?: unknown[] }) {
  const lessons = Number(course?.numberLessons || 0);
  if (lessons > 0) return lessons;
  return course?.ebookFiles?.length ?? 0;
}

export function startOfToday() {
  return startOfDay(new Date());
}

export function yesterday() {
  return startOfDay(subDays(new Date(), 1));
}

export function isSameDay(value?: DateLike) {
  const d = asDate(value);
  return d ? isToday(d) : false;
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
