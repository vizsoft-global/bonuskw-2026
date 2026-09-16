import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

/**
 * Whether the email or phone the student is about to add is still free.
 *
 * Ownership is proven by the verification itself, so this only decides which
 * screen appears: `taken` offers to sign in to the account that already holds the
 * identifier instead of letting the student claim it. The write path checks again
 * and the SDK refuses a duplicate regardless, so a stale answer here is harmless.
 *
 * `methods` lists how that other account signs in, so the screen can name it.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; value?: unknown };
  const kind = body.kind === "phone" ? "phone" : "email";
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return NextResponse.json({ error: "value required" }, { status: 400 });

  const auth = getAdminAuth();
  try {
    const found =
      kind === "email" ? await auth.getUserByEmail(value) : await auth.getUserByPhoneNumber(value);
    if (found.uid === user.uid) return NextResponse.json({ state: "mine" });
    const methods = [...new Set(found.providerData.map((p) => p.providerId))];
    return NextResponse.json({ state: "taken", methods });
  } catch {
    // "Not found" is the normal answer here, and any other failure must not stop
    // a student from adding their own email or number.
    return NextResponse.json({ state: "free" });
  }
}
