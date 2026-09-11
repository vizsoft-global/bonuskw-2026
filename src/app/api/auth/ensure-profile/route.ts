import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { avatarSeed, generatedAvatar } from "@/lib/avatar";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import { isE164 } from "@/lib/server/otp";
import { findLegacyUserByPhone, toE164 } from "@/lib/server/phone";

export const runtime = "nodejs";

const SOCIAL_PROVIDERS = new Set(["google.com", "apple.com"]);

/**
 * Creates or completes `users/{uid}` for the signed-in Firebase user. When a
 * phone is supplied (phone sign-in, or a phone linked during onboarding) it is
 * recorded only if no other student already owns that number.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const bodyPhone = typeof body.phone === "string" && isE164(body.phone) ? body.phone : "";
  const phone = toE164(bodyPhone || user.phone_number || "") ?? "";
  const provider = user.firebase?.sign_in_provider ?? "";
  const social = SOCIAL_PROVIDERS.has(provider);

  try {
    const db = getAdminDb();
    const ref = db.collection(collections.users).doc(user.uid);
    const snap = await ref.get();
    const patch: Record<string, unknown> = { uid: user.uid };
    let phoneConflict = false;

    if (phone) {
      const owner = await findLegacyUserByPhone(db, phone, user.uid);
      if (owner) {
        phoneConflict = true;
      } else if (!snap.exists || !snap.get("phone_number") || toE164(snap.get("phone_number")) === phone) {
        if (!snap.get("phone_number")) patch.phone_number = phone;
        patch.phoneE164 = phone;
        patch.phoneVerified = true;
      }
    } else if (snap.exists && snap.get("phone_number") && !snap.get("phoneE164")) {
      const canonical = toE164(snap.get("phone_number"));
      if (canonical) patch.phoneE164 = canonical;
    }

    if (!snap.exists) {
      patch.userRole = "Student";
      patch.created_time = FieldValue.serverTimestamp();
    } else {
      const existingRole = String(snap.get("userRole") ?? "").trim();
      if (!existingRole || existingRole.toLowerCase() === "user") {
        patch.userRole = "Student";
      }
    }

    if (social || !snap.exists) {
      if (user.email) patch.email = user.email;
      if (user.name && !snap.get("display_name")) patch.display_name = user.name;
      if (user.picture && !snap.get("photo_url")) patch.photo_url = user.picture;
      if (user.email_verified) patch.emailVerifed = true;
    }

    // Everyone gets a face: a new profile with no photo is given a generated
    // avatar keyed by mobile number (else email, else name) so it is unique
    // and stable across the student app, admin and any other consumer.
    if (!snap.exists && !patch.photo_url) {
      patch.photo_url = generatedAvatar(
        avatarSeed(
          {
            phoneE164: (patch.phoneE164 as string | undefined) || phone,
            email: user.email,
            display_name: user.name,
          },
          user.uid,
        ),
      );
    }

    await ref.set(patch, { merge: true });
    return NextResponse.json({ ok: true, created: !snap.exists, phoneConflict });
  } catch {
    return NextResponse.json({ error: "Could not save profile" }, { status: 500 });
  }
}
