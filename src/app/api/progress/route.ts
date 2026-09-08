import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    lessonId?: string;
    courseId?: string;
    chapterId?: string;
    positionSec?: number;
    durationSec?: number;
    deltaSec?: number;
  };
  if (!body.lessonId || !body.courseId) {
    return NextResponse.json({ error: "lessonId and courseId required" }, { status: 400 });
  }

  const db = getAdminDb();
  const id = `${user.uid}_${body.lessonId}`;
  const completed =
    (body.durationSec ?? 0) > 0 &&
    (body.positionSec ?? 0) / (body.durationSec ?? 1) >= 0.9;

  await db.collection(collections.watchProgress).doc(id).set(
    {
      userRef: db.collection(collections.users).doc(user.uid),
      courseRef: db.collection(collections.course).doc(body.courseId),
      chapterRef: body.chapterId
        ? db.collection(collections.chapter).doc(body.chapterId)
        : null,
      lessonId: body.lessonId,
      positionSec: Math.max(0, body.positionSec ?? 0),
      durationSec: Math.max(0, body.durationSec ?? 0),
      completed,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const delta = Math.min(30, Math.max(0, body.deltaSec ?? 0));
  const statsRef = db.collection(collections.userStats).doc(user.uid);
  const stats = await statsRef.get();
  const last = stats.get("lastStudyDate")?.toDate?.() as Date | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = last ? last.toISOString().slice(0, 10) : "";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let streak = Number(stats.get("streakDays") || 0);
  if (lastDay !== today) streak = lastDay === yesterday ? streak + 1 : 1;

  await statsRef.set(
    {
      streakDays: streak,
      lastStudyDate: FieldValue.serverTimestamp(),
      studySeconds: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, completed });
}
