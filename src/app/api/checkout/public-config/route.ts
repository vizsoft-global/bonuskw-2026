import { NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";

export const runtime = "nodejs";

export async function GET() {
  const res = await fetch(`${ADMIN_API_BASE}/api/checkout/public-config`, {
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
