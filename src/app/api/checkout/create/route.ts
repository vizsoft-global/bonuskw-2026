import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await fetch(`${ADMIN_API_BASE}/api/checkout/create`, {
    method: "POST",
    headers: {
      Authorization: req.headers.get("authorization") || "",
      "Content-Type": "application/json",
    },
    body: await req.text(),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
