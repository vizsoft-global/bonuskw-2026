import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

/** Proxies the combined due-payment link lookup to the admin API. */
export async function GET(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL("/api/dues/request", ADMIN_API_BASE);
  url.search = req.nextUrl.search;
  const res = await fetch(url, {
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
