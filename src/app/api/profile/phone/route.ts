import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import { toE164 } from "@/lib/server/phone";

export const runtime = "nodejs";

/**
 * Saves a student's number without an SMS code. Only available while
 * `adminConfig/studentApp.skipPhoneVerification` is on, and only for the
 * signed-in student. The number is stored as a contact number: it is not
 * marked verified and is not linked to Firebase Auth, so it cannot sign in.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const config = await db.collection(collections.adminConfig).doc("studentApp").get();
  if (config.get("skipPhoneVerification") !== true) {
    return NextResponse.json({ error: "Phone verification is required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const e164 = toE164(body.phone);
  if (!e164) return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });

  await db.collection(collections.users).doc(user.uid).set(
    { phone_number: e164, phoneE164: e164 },
    { merge: true },
  );
  return NextResponse.json({ ok: true, phone: e164 });
}
