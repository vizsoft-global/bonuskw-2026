import "server-only";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/firebase/collections";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

/**
 * Single-use sign-in links minted by admins for students whose carriers block
 * the verification SMS. The admin app writes `signInLinks/{sha256(token)}`
 * with `{ uid, expiresAt, usedAt: null }`; this side redeems it. The raw token
 * is never stored, so a leaked database dump cannot be replayed.
 */

export type SignInLinkError = "invalid" | "expired" | "used" | "not_student";

export class SignInLinkFailure extends Error {
  code: SignInLinkError;
  constructor(code: SignInLinkError) {
    super(code);
    this.code = code;
  }
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function hashSignInToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function redeemSignInLink(token: string, ip = ""): Promise<string> {
  if (!TOKEN_RE.test(token)) throw new SignInLinkFailure("invalid");
  const db = getAdminDb();
  const ref = db.collection(collections.signInLinks).doc(hashSignInToken(token));

  const uid = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new SignInLinkFailure("invalid");
    const data = snap.data() ?? {};
    if (data.usedAt) throw new SignInLinkFailure("used");
    const expires = (data.expiresAt as { toDate?: () => Date } | undefined)?.toDate?.();
    if (!expires || expires.getTime() < Date.now()) throw new SignInLinkFailure("expired");
    const target = typeof data.uid === "string" ? data.uid : "";
    if (!target) throw new SignInLinkFailure("invalid");
    tx.update(ref, { usedAt: FieldValue.serverTimestamp(), usedIp: ip || null });
    return target;
  });

  // Links are only ever minted for students; refuse anything else even if a
  // record was tampered with, so this can never become a staff back door.
  const userRef = db.collection(collections.users).doc(uid);
  const user = await userRef.get();
  const role = String(user.get("userRole") ?? "Student").trim().toLowerCase();
  if (user.exists && role && role !== "student" && role !== "user") {
    throw new SignInLinkFailure("not_student");
  }

  const auth = getAdminAuth();
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({ uid });
  }
  await userRef
    .set(
      {
        uid,
        userRole: user.get("userRole") ?? "Student",
        lastSignInLinkAt: FieldValue.serverTimestamp(),
        ...(user.exists ? {} : { created_time: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    )
    .catch(() => undefined);

  return auth.createCustomToken(uid);
}
