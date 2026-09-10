import { NextRequest, NextResponse } from "next/server";
import { clientIp, verifyIdToken } from "@/lib/server/auth";
import { startSession } from "@/lib/server/session";

export const runtime = "nodejs";

type Body = { deviceId?: string; os?: string; browser?: string; model?: string; force?: boolean };

function short(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * 200 { sessionId }             — session started
 * 409 { conflict: [...] }       — signed in elsewhere; retry with `force: true` to take over
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const deviceId = short(body.deviceId, 128);
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

  try {
    const result = await startSession(
      { uid: user.uid, email: user.email, phone: user.phone_number },
      {
        deviceId,
        os: short(body.os),
        browser: short(body.browser),
        model: short(body.model),
        ip: clientIp(req),
        city: req.headers.get("x-vercel-ip-city") ?? "",
      },
      { force: body.force === true },
    );
    if (!result.ok) {
      return NextResponse.json({ conflict: result.conflict }, { status: 409 });
    }
    return NextResponse.json({ sessionId: result.sessionId });
  } catch (err) {
    console.error("session/start", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start session" }, { status: 500 });
  }
}
