import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

/** The client downsizes to 512px before sending; this is a hard ceiling. */
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Stores a profile photo for the signed-in student and points `photo_url` at
 * it. Goes through the Admin SDK so the bucket's client rules never matter;
 * the download-token URL works whatever the bucket's ACL mode is.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large" }, { status: 413 });

  const bucket = getAdminStorage().bucket();
  const path = `avatars/${user.uid}/${Date.now()}.${ext}`;
  const token = randomUUID();
  await bucket.file(path).save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: token, owner: user.uid },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

  await getAdminDb()
    .collection(collections.users)
    .doc(user.uid)
    .set({ photo_url: url, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return NextResponse.json({ url });
}
