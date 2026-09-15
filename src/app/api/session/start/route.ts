import { NextRequest, NextResponse } from "next/server";
import { clientIp, verifyIdToken } from "@/lib/server/auth";
import { startSession } from "@/lib/server/session";

export const runtime = "nodejs";

type Body = { deviceId?: string; os?: string; browser?: string; model?: string; force?: boolean };

const DEVICE_COOKIE = "ba_device";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

function short(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * The cookie is the durable device id: it outlives a cleared localStorage, so a
 * browser is not mistaken for a new device after its storage is wiped — which
 * used to raise a take-over prompt and sign the student out of the tab or PWA
 * they were actually using.
 */
function cookieDeviceId(req: NextRequest) {
  const value = req.cookies.get(DEVICE_COOKIE)?.value?.trim() ?? "";
  return DEVICE_ID_RE.test(value) ? value : "";
}

/**
 * 200 { sessionId, deviceId }   — session started
 * 409 { conflict: [...] }       — a live session on another device; retry with `force: true` to take over
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const bodyId = short(body.deviceId, 128);
  const deviceId = cookieDeviceId(req) || (DEVICE_ID_RE.test(bodyId) ? bodyId : "");
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
    const res = NextResponse.json({ sessionId: result.sessionId, deviceId });
    res.cookies.set({
      name: DEVICE_COOKIE,
      value: deviceId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("session/start", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not start session" }, { status: 500 });
  }
}
