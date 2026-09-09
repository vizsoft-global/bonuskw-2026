import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import { isE164 } from "@/lib/server/otp";

export const runtime = "nodejs";

const SOCIAL_PROVIDERS = new Set(["google.com", "apple.com"]);

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const bodyPhone = typeof body.phone === "string" && isE164(body.phone) ? body.phone : "";
  const phone = bodyPhone || user.phone_number || "";
  const provider = user.firebase?.sign_in_provider ?? "";
  const social = SOCIAL_PROVIDERS.has(provider);

  try {
    const ref = getAdminDb().collection(collections.users).doc(user.uid);
    const snap = await ref.get();
    const patch: Record<string, unknown> = { uid: user.uid };

    if (!snap.exists) {
      patch.userRole = "Student";
      patch.created_time = FieldValue.serverTimestamp();
      patch.phone_number = phone;
      patch.phoneVerified = Boolean(phone);
    } else if (phone && !snap.get("phone_number")) {
      patch.phone_number = phone;
      patch.phoneVerified = true;
    }

    if (social || !snap.exists) {
      if (user.email) patch.email = user.email;
      if (user.name && !snap.get("display_name")) patch.display_name = user.name;
      if (user.picture && !snap.get("photo_url")) patch.photo_url = user.picture;
      if (user.email_verified) patch.emailVerifed = true;
    }

    await ref.set(patch, { merge: true });
    return NextResponse.json({ ok: true, created: !snap.exists });
  } catch {
    return NextResponse.json({ error: "Could not save profile" }, { status: 500 });
  }
}
