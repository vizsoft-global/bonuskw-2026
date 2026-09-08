import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  await getAdminDb()
    .collection(collections.users)
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        phone_number: body.phone || user.phone_number || "",
        email: user.email || "",
        display_name: user.name || "",
        photo_url: user.picture || "",
        phoneVerified: Boolean(body.phone || user.phone_number),
        userRole: "Student",
        created_time: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return NextResponse.json({ ok: true });
}
