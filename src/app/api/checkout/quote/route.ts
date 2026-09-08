import { NextRequest, NextResponse } from "next/server";
import { ADMIN_API_BASE } from "@/lib/firebase/config";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

async function forward(req: NextRequest, path: string, method: "GET" | "POST") {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = req.headers.get("authorization");
  const url = new URL(path, ADMIN_API_BASE);
  if (method === "GET") url.search = req.nextUrl.search;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: token || "",
      "Content-Type": "application/json",
    },
    body: method === "POST" ? await req.text() : undefined,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export function POST(req: NextRequest) {
  return forward(req, "/api/checkout/quote", "POST");
}
