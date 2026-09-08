import { NextRequest, NextResponse } from "next/server";
import { sendGatewayOtp } from "@/lib/server/otp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    channel?: "whatsapp" | "sms";
  };
  if (!body.phone?.startsWith("+")) {
    return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
  }
  try {
    await sendGatewayOtp(body.phone, body.channel === "sms" ? "sms" : "whatsapp");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 400 },
    );
  }
}
