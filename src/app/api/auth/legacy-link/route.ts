import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/auth";
import { isE164, legacyLinkToken, legacyLinkTokenByEmail } from "@/lib/server/otp";
import { toE164 } from "@/lib/server/phone";

export const runtime = "nodejs";

/**
 * Mints a token for the legacy profile that owns the caller's identity.
 *
 * Identity is taken from the ID token only — a verified phone number (phone
 * sign-in or phone link) or a verified email (Google, Apple, verified password
 * account). The body's `phone` is just a hint that must agree with the token.
 * Trusting anything the client typed would let any signed-in user claim any
 * account by posting its number or address.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const requested = typeof body.phone === "string" ? body.phone.trim() : "";
  const verified = toE164(user.phone_number ?? "") ?? "";
  const phone = verified && (!requested || toE164(requested) === verified) ? verified : "";
  try {
    if (isE164(phone)) {
      const customToken = await legacyLinkToken(user.uid, phone);
      if (customToken) return NextResponse.json({ customToken });
    }
    if (user.email && user.email_verified === true) {
      const customToken = await legacyLinkTokenByEmail(user.uid, user.email);
      if (customToken) return NextResponse.json({ customToken });
    }
    return NextResponse.json({ customToken: null });
  } catch {
    return NextResponse.json({ error: "Could not link account" }, { status: 500 });
  }
}
