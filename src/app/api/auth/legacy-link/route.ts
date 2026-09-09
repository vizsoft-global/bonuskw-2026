import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/auth";
import { isE164, legacyLinkToken } from "@/lib/server/otp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!isE164(phone)) return NextResponse.json({ customToken: null });
  try {
    const customToken = await legacyLinkToken(user.uid, phone);
    return NextResponse.json({ customToken });
  } catch {
    return NextResponse.json({ error: "Could not link account" }, { status: 500 });
  }
}
