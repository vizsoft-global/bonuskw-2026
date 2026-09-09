import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/auth";
import { listDevices } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentDeviceId =
    req.nextUrl.searchParams.get("deviceId") ?? req.cookies.get("ba_device")?.value ?? "";
  try {
    const items = await listDevices(user.uid, currentDeviceId);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Could not load devices" }, { status: 500 });
  }
}
