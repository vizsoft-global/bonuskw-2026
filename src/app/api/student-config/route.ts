import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The `adminConfig/studentApp` switches the student UI needs *before* it can
 * render anything.
 *
 * That document is `allow read: if isSignedIn()` in Firestore rules, so reading
 * it from the browser fails for signed-out visitors and they silently fall back
 * to the defaults — a guest would see chapter numbers after a super admin turned
 * them off. The Admin SDK here has no such restriction, so guests and students
 * get the same answer.
 *
 * Public on purpose: never add anything sensitive to this response.
 */
export async function GET() {
  let chapterPrefix = true;
  try {
    const snap = await getAdminDb().collection(collections.adminConfig).doc("studentApp").get();
    chapterPrefix = snap.get("chapterPrefix") !== false;
  } catch (err) {
    console.error("[student-config]", err instanceof Error ? err.message : err);
  }
  return NextResponse.json(
    { chapterPrefix },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
      },
    },
  );
}
