import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/server/auth";
import { redeemSignInLink, SignInLinkFailure } from "@/lib/server/sign-in-link";

export const runtime = "nodejs";

/** Redeems an admin-minted single-use sign-in link for a Firebase custom token. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const customToken = await redeemSignInLink(token, clientIp(req));
    return NextResponse.json({ customToken });
  } catch (err) {
    if (err instanceof SignInLinkFailure) {
      const status = err.code === "not_student" ? 403 : err.code === "invalid" ? 404 : 410;
      return NextResponse.json({ error: err.code }, { status });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
