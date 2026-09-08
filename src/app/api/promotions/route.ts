import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ promotions: [] });
  const res = await fetch(`${ADMIN_API_BASE}/api/promotions${req.nextUrl.search}`, {
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
