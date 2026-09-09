import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/server/auth";
import { isE164, OtpError, sendGatewayOtp } from "@/lib/server/otp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; channel?: unknown };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!isE164(phone)) {
    return NextResponse.json(
      { error: "Enter a valid mobile number", code: "invalid_phone" },
      { status: 400 },
    );
  }
  const channel = body.channel === "sms" ? "sms" : "whatsapp";
  try {
    await sendGatewayOtp(phone, channel, clientIp(req));
    return NextResponse.json({ ok: true, channel });
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: "Send failed", code: "send_failed" }, { status: 500 });
  }
}
