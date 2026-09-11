import "server-only";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { findLegacyUserByEmail, findLegacyUserByPhone } from "@/lib/server/phone";

const TTL_MS = 5 * 60 * 1000;
const PHONE_COOLDOWN_MS = 30_000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;
const E164 = /^\+[1-9]\d{6,14}$/;

export type OtpChannel = "whatsapp" | "sms";

export type OtpErrorCode =
  | "invalid_phone"
  | "rate_limited"
  | "send_failed"
  | "not_requested"
  | "expired"
  | "too_many_attempts"
  | "invalid_code";

export class OtpError extends Error {
  code: OtpErrorCode;
  status: number;
  constructor(code: OtpErrorCode, message: string, status = 400) {
    super(message);
    this.name = "OtpError";
    this.code = code;
    this.status = status;
  }
}

const ipMemory = new Map<string, { count: number; windowStart: number }>();

export function isE164(phone: string) {
  return E164.test(phone);
}

function hashCode(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function ipKey(ip: string) {
  return `ip_${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function bumpMemory(ip: string) {
  const now = Date.now();
  const entry = ipMemory.get(ip);
  if (!entry || now - entry.windowStart > IP_WINDOW_MS) {
    ipMemory.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= IP_MAX_PER_WINDOW;
}

async function enforceIpLimit(ip: string) {
  if (!ip) return;
  const db = getAdminDb();
  const ref = db.collection(collections.otpRequests).doc(ipKey(ip));
  let allowed = true;
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const windowStart = (snap.get("windowStart")?.toDate?.() as Date | undefined)?.getTime();
      const count = Number(snap.get("count") ?? 0);
      if (!snap.exists || !windowStart || now - windowStart > IP_WINDOW_MS) {
        tx.set(ref, { kind: "ip", count: 1, windowStart: new Date(now), updatedAt: new Date(now) });
        return;
      }
      if (count >= IP_MAX_PER_WINDOW) {
        allowed = false;
        return;
      }
      tx.update(ref, { count: FieldValue.increment(1), updatedAt: new Date(now) });
    });
  } catch {
    allowed = bumpMemory(ip);
  }
  if (!allowed) {
    throw new OtpError("rate_limited", "Too many codes requested from this network. Try again later.", 429);
  }
}

export async function sendGatewayOtp(phone: string, channel: OtpChannel, ip = "") {
  if (!isE164(phone)) throw new OtpError("invalid_phone", "Enter a valid mobile number.");
  await enforceIpLimit(ip);

  const db = getAdminDb();
  const ref = db.collection(collections.otpRequests).doc(phone.replace(/\D/g, ""));
  const existing = await ref.get();
  const sentAt = existing.get("sentAt")?.toDate?.() as Date | undefined;
  if (sentAt && Date.now() - sentAt.getTime() < PHONE_COOLDOWN_MS) {
    throw new OtpError("rate_limited", "Wait a few seconds before requesting another code.", 429);
  }

  const code = String(randomInt(100000, 999999));
  await ref.set({
    kind: "phone",
    phone,
    channel,
    hash: hashCode(phone, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + TTL_MS),
    sentAt: FieldValue.serverTimestamp(),
  });

  const message =
    channel === "whatsapp"
      ? `Bonus Academy code: ${code}`
      : `Bonus Academy verification code: ${code}`;
  const endpoint =
    process.env.OTP_GATEWAY_URL ?? "https://proxy.vizsoft.in/https://backend.vizsoft.in/send_sms";
  let ok = false;
  let detail = "";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The Vizsoft proxy expects these, same as the admin's SMS route.
        origin: "https://proxy.vizsoft.in",
        "x-requested-with": "https://backend.vizsoft.in",
      },
      body: JSON.stringify({ message, to_numbers: [phone], channel }),
    });
    const text = await res.text();
    let body: { status?: unknown; message?: unknown } = {};
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      /* non-JSON gateway reply */
    }
    // The gateway answers 200 with `status: "error"` for provider failures.
    ok = res.ok && body.status !== "error" && body.status !== false;
    if (!ok) {
      detail = typeof body.message === "string" ? body.message : text.slice(0, 200);
      console.error(`[otp] ${channel} send failed for ${phone}: HTTP ${res.status} ${detail}`);
    }
  } catch (err) {
    ok = false;
    detail = err instanceof Error ? err.message : "network error";
    console.error(`[otp] ${channel} gateway unreachable: ${detail}`);
  }
  if (!ok) {
    await ref.delete().catch(() => undefined);
    throw new OtpError(
      "send_failed",
      channel === "whatsapp"
        ? "WhatsApp delivery is unavailable right now. Try SMS or wait a moment."
        : "SMS delivery is unavailable right now. Try WhatsApp or wait a moment.",
      502,
    );
  }
}

export async function verifyGatewayOtp(phone: string, code: string) {
  if (!isE164(phone)) throw new OtpError("invalid_phone", "Enter a valid mobile number.");
  const cleanCode = code.replace(/\D/g, "");
  if (cleanCode.length !== 6) throw new OtpError("invalid_code", "Invalid code");

  const db = getAdminDb();
  const ref = db.collection(collections.otpRequests).doc(phone.replace(/\D/g, ""));
  const snap = await ref.get();
  if (!snap.exists) throw new OtpError("not_requested", "Request a code first");
  const data = snap.data() ?? {};
  const expires = data.expiresAt?.toDate?.() as Date | undefined;
  if (!expires || expires.getTime() < Date.now()) throw new OtpError("expired", "Code expired");
  if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
    throw new OtpError("too_many_attempts", "Too many attempts", 429);
  }
  if (!safeEqual(String(data.hash ?? ""), hashCode(phone, cleanCode))) {
    await ref.update({ attempts: FieldValue.increment(1) });
    throw new OtpError("invalid_code", "Invalid code");
  }
  await ref.delete();
  return issueTokenForPhone(phone);
}

export async function issueTokenForPhone(phone: string, currentUid?: string) {
  const db = getAdminDb();
  const auth = getAdminAuth();
  // Legacy Flutter accounts stored the number in several spellings; match all.
  const legacy = await findLegacyUserByPhone(db, phone);

  let uid = currentUid;
  if (legacy) {
    uid = legacy.id;
  }
  if (!uid) {
    try {
      const existing = await auth.getUserByPhoneNumber(phone);
      uid = existing.uid;
    } catch {
      const created = await auth.createUser({ phoneNumber: phone });
      uid = created.uid;
    }
  } else {
    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({ uid, phoneNumber: phone });
    }
  }

  const userRef = db.collection(collections.users).doc(uid);
  const existing = await userRef.get();
  await userRef.set(
    {
      uid,
      // Keep the legacy spelling if one exists; add the canonical form beside it.
      ...(existing.get("phone_number") ? {} : { phone_number: phone }),
      phoneE164: phone,
      phoneVerified: true,
      userRole: existing.get("userRole") ?? "Student",
      ...(existing.exists ? {} : { created_time: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );

  return auth.createCustomToken(uid);
}

/**
 * After a Firebase phone sign-in created (or reused) an Auth user, find the
 * legacy Firestore account that owns the number and mint a token for it so the
 * student lands on their enrollments instead of an empty profile.
 */
export async function legacyLinkToken(currentUid: string, phone: string) {
  if (!isE164(phone)) return null;
  const db = getAdminDb();
  const legacy = await findLegacyUserByPhone(db, phone, currentUid);
  if (!legacy) return null;
  // Stamp the canonical number so the next lookup is a single indexed hit.
  await legacy.ref.set({ phoneE164: phone, phoneVerified: true }, { merge: true }).catch(() => undefined);
  return getAdminAuth().createCustomToken(legacy.id);
}

/**
 * Same as `legacyLinkToken` but keyed by a *verified* email (Google / Apple /
 * verified password accounts). Lets students whose carriers block the
 * verification SMS reach their existing account without a phone code.
 */
export async function legacyLinkTokenByEmail(currentUid: string, email: string) {
  const db = getAdminDb();
  const legacy = await findLegacyUserByEmail(db, email, currentUid);
  if (!legacy) return null;
  await legacy.ref.set({ emailVerifed: true }, { merge: true }).catch(() => undefined);
  return getAdminAuth().createCustomToken(legacy.id);
}
