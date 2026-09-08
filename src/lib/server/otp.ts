import "server-only";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";

const TTL_MS = 5 * 60 * 1000;

function hashCode(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function sendGatewayOtp(phone: string, channel: "whatsapp" | "sms") {
  const db = getAdminDb();
  const ref = db.collection(collections.otpRequests).doc(phone.replace(/\D/g, ""));
  const existing = await ref.get();
  const sentAt = existing.get("sentAt")?.toDate?.() as Date | undefined;
  if (sentAt && Date.now() - sentAt.getTime() < 30_000) {
    throw new Error("Wait a few seconds before requesting another code.");
  }
  const code = String(randomInt(100000, 999999));
  await ref.set({
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
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      to_numbers: [phone],
      channel,
    }),
  });
  if (!res.ok) {
    throw new Error("Could not send the code. Try Firebase SMS or another network.");
  }
}

export async function verifyGatewayOtp(phone: string, code: string) {
  const db = getAdminDb();
  const id = phone.replace(/\D/g, "");
  const ref = db.collection(collections.otpRequests).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Request a code first");
  const data = snap.data() ?? {};
  const expires = data.expiresAt?.toDate?.() as Date | undefined;
  if (!expires || expires.getTime() < Date.now()) throw new Error("Code expired");
  if ((data.attempts ?? 0) >= 5) throw new Error("Too many attempts");
  if (!safeEqual(String(data.hash ?? ""), hashCode(phone, code.trim()))) {
    await ref.update({ attempts: FieldValue.increment(1) });
    throw new Error("Invalid code");
  }
  await ref.delete();
  return issueTokenForPhone(phone);
}

export async function issueTokenForPhone(phone: string, currentUid?: string) {
  const db = getAdminDb();
  const auth = getAdminAuth();
  const match = await db
    .collection(collections.users)
    .where("phone_number", "==", phone)
    .limit(1)
    .get();

  let uid = currentUid;
  if (!match.empty) {
    uid = match.docs[0].id;
  }
  if (!uid) {
    const created = await auth.createUser({ phoneNumber: phone });
    uid = created.uid;
  } else {
    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({ uid, phoneNumber: phone });
    }
  }

  await db
    .collection(collections.users)
    .doc(uid)
    .set(
      {
        uid,
        phone_number: phone,
        phoneVerified: true,
        userRole: "Student",
        created_time: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return auth.createCustomToken(uid);
}

export async function legacyLinkToken(currentUid: string, phone: string) {
  const db = getAdminDb();
  const match = await db
    .collection(collections.users)
    .where("phone_number", "==", phone)
    .limit(5)
    .get();
  const legacy = match.docs.find((doc) => doc.id !== currentUid);
  if (!legacy) return null;
  return getAdminAuth().createCustomToken(legacy.id);
}
