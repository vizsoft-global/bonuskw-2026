import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const ref = getAdminDb().collection(collections.sessions).doc(body.sessionId);
  const snap = await ref.get();
  if (!snap.exists || snap.get("userref")?.id !== user.uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ref.update({ lastSeenAt: FieldValue.serverTimestamp() });
  return NextResponse.json({ ok: true, isActive: snap.get("isActive") !== false });
}
