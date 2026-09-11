import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";

export const runtime = "nodejs";

/** Forwards the staff password to the admin API; no login is required. */
export async function POST(req: NextRequest) {
  const res = await fetch(`${ADMIN_API_BASE}/api/maintenance/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}
