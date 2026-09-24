import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  const clientIp = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const res = await fetch(`${ADMIN_API_BASE}/api/support/tickets`, {
    method: "POST",
    headers: {
      Authorization: req.headers.get("authorization") || "",
      "Content-Type": "application/json",
      ...(clientIp ? { "x-bonus-client-ip": clientIp } : {}),
    },
    body: await req.text(),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
