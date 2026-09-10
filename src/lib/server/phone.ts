import "server-only";
import type { DocumentSnapshot, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { collections } from "@/lib/firebase/collections";

/**
 * Legacy `users.phone_number` values were written by the Flutter app in several
 * shapes: "+96599…", "96599…", "99…", "099…", with or without spaces. New
 * writes also set `phoneE164`, and matching tries that first.
 */

export function toE164(raw: string | null | undefined, countryCode = "965"): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  let national = digits;
  if (digits.startsWith("00" + countryCode)) national = digits.slice(2 + countryCode.length);
  else if (digits.startsWith(countryCode) && digits.length > 8) national = digits.slice(countryCode.length);
  national = national.replace(/^0+/, "");
  if (national.length < 7 || national.length > 12) return null;
  return `+${countryCode}${national}`;
}

/** Every spelling a legacy doc might have stored for this E.164 number. */
export function phoneVariants(e164: string, countryCode = "965"): string[] {
  const digits = e164.replace(/\D/g, "");
  const national = digits.startsWith(countryCode) ? digits.slice(countryCode.length) : digits;
  const set = new Set<string>([
    e164,
    digits,
    national,
    `0${national}`,
    `00${digits}`,
    `+${countryCode} ${national}`,
    `${countryCode} ${national}`,
  ]);
  return [...set].filter(Boolean);
}

type Snap = QueryDocumentSnapshot | DocumentSnapshot;

function ms(value: unknown): number {
  const d = (value as { toDate?: () => Date } | undefined)?.toDate?.();
  return d ? d.getTime() : 0;
}

/**
 * When several docs share a number (118 known cases), prefer the one that
 * looks like the real, used account: recently active, with academic info,
 * then the oldest.
 */
export function pickPrimary<T extends Snap>(docs: T[]): T | null {
  if (!docs.length) return null;
  const score = (d: T) => {
    const data = d.data() ?? {};
    let s = 0;
    if (data.universityRef) s += 4;
    if (data.display_name || data.firstName) s += 2;
    if (data.email) s += 1;
    if (data.userRole && data.userRole !== "Student") s += 8;
    return s;
  };
  return [...docs].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff) return diff;
    const active = ms(b.data()?.lastActive) - ms(a.data()?.lastActive);
    if (active) return active;
    return ms(a.data()?.created_time) - ms(b.data()?.created_time);
  })[0];
}

/** All user docs that own this phone, in any legacy spelling. */
export async function usersByPhone(db: Firestore, e164: string): Promise<QueryDocumentSnapshot[]> {
  const users = db.collection(collections.users);
  const byId = new Map<string, QueryDocumentSnapshot>();
  const exact = await users.where("phoneE164", "==", e164).limit(10).get();
  for (const d of exact.docs) byId.set(d.id, d);
  const variants = phoneVariants(e164).slice(0, 10);
  const legacy = await users.where("phone_number", "in", variants).limit(10).get();
  for (const d of legacy.docs) byId.set(d.id, d);
  return [...byId.values()];
}

/** The account that should receive a phone sign-in for `e164`, excluding `notUid`. */
export async function findLegacyUserByPhone(db: Firestore, e164: string, notUid?: string) {
  const docs = (await usersByPhone(db, e164)).filter((d) => d.id !== notUid);
  return pickPrimary(docs);
}
