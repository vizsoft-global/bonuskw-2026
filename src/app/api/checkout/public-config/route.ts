import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";

export const runtime = "nodejs";

/** Optional bearer token lets a dev-mode tester see test-mode hints. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const res = await fetch(`${ADMIN_API_BASE}/api/checkout/public-config`, {
    cache: "no-store",
    headers: auth ? { Authorization: auth } : undefined,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
