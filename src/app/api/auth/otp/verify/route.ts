import { NextRequest, NextResponse } from "next/server";
import { isE164, OtpError, verifyGatewayOtp } from "@/lib/server/otp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; code?: unknown };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isE164(phone) || !code) {
    return NextResponse.json(
      { error: "Phone and code are required", code: "invalid_code" },
      { status: 400 },
    );
  }
  try {
    const customToken = await verifyGatewayOtp(phone, code);
    return NextResponse.json({ customToken });
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: "Verify failed", code: "invalid_code" }, { status: 500 });
  }
}
