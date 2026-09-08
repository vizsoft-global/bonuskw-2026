import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/auth";
import { legacyLinkToken } from "@/lib/server/otp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  if (!body.phone) return NextResponse.json({ customToken: null });
  const customToken = await legacyLinkToken(user.uid, body.phone);
  return NextResponse.json({ customToken });
}
