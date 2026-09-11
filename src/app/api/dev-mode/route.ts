import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

/** Dev-mode unlock / lock for testers; the admin API owns the rule. */
async function forward(req: NextRequest, method: "POST" | "DELETE") {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await fetch(`${ADMIN_API_BASE}/api/checkout/dev-mode`, {
    method,
    headers: {
      Authorization: req.headers.get("authorization") || "",
      "Content-Type": "application/json",
    },
    body: method === "POST" ? await req.text() : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: NextRequest) {
  return forward(req, "POST");
}

export async function DELETE(req: NextRequest) {
  return forward(req, "DELETE");
}
