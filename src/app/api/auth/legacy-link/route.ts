import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/auth";
import { isE164, legacyLinkToken } from "@/lib/server/otp";
import { toE164 } from "@/lib/server/phone";

export const runtime = "nodejs";

/**
 * Mints a token for the legacy profile that owns the caller's phone number.
 * The number is taken from the ID token (set by phone sign-in or a phone
 * link), never from the body alone — otherwise any signed-in user could claim
 * any account by posting its number.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const requested = typeof body.phone === "string" ? body.phone.trim() : "";
  const verified = toE164(user.phone_number ?? "") ?? "";
  const phone = verified && (!requested || toE164(requested) === verified) ? verified : "";
  if (!isE164(phone)) return NextResponse.json({ customToken: null });
  try {
    const customToken = await legacyLinkToken(user.uid, phone);
    return NextResponse.json({ customToken });
  } catch {
    return NextResponse.json({ error: "Could not link account" }, { status: 500 });
  }
}
