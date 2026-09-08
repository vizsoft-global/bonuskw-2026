import { NextRequest, NextResponse } from "next/server";
import { verifyGatewayOtp } from "@/lib/server/otp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  if (!body.phone || !body.code) {
    return NextResponse.json({ error: "Phone and code are required" }, { status: 400 });
  }
  try {
    const customToken = await verifyGatewayOtp(body.phone, body.code);
    return NextResponse.json({ customToken });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verify failed" },
      { status: 400 },
    );
  }
}
