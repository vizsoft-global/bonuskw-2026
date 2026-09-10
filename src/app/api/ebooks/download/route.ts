import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { clientIp, verifyIdToken } from "@/lib/server/auth";
import { signedGatewayUrl } from "@/lib/server/files-gateway";
import type { CourseDoc } from "@/lib/types/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { courseId?: string; fileId?: string };
  if (!body.courseId || !body.fileId) {
    return NextResponse.json({ error: "courseId and fileId required" }, { status: 400 });
  }

  const db = getAdminDb();
  const userRef = db.collection(collections.users).doc(user.uid);
  const courseRef = db.collection(collections.course).doc(body.courseId);
  const access = await db
    .collection(collections.ebookAccess)
    .where("userRef", "==", userRef)
    .where("courseRef", "==", courseRef)
    .limit(3)
    .get();
  const owned = access.docs.some(
    (d) => d.get("status") === "Ongoing" && d.get("payment_status") === "CAPTURED",
  );
  if (!owned) return NextResponse.json({ error: "Locked" }, { status: 403 });

  const course = (await courseRef.get()).data() as CourseDoc | undefined;
  const file = course?.ebookFiles?.find((f) => f.id === body.fileId);
  if (!file?.storagePath) return NextResponse.json({ error: "File missing" }, { status: 404 });

  // New files sit in Cloudflare R2 behind the signed gateway; legacy ones in Firebase Storage.
  const url =
    file.provider === "r2"
      ? await signedGatewayUrl(file.storagePath)
      : (
          await getAdminStorage()
            .bucket()
            .file(file.storagePath)
            .getSignedUrl({ action: "read", expires: Date.now() + 10 * 60 * 1000 })
        )[0];

  await db.collection(collections.ebookDownloads).add({
    courseRef,
    userRef,
    fileId: file.id,
    fileName: file.name,
    downloadedAt: FieldValue.serverTimestamp(),
    ip: clientIp(req),
    device: "Web",
  });

  return NextResponse.json({ url, name: file.name });
}
