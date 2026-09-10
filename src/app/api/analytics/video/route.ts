import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { VideoDelta } from "@/lib/analytics/video-tracker";

export const runtime = "nodejs";

/**
 * Receives playback deltas from the tracker (fetch or sendBeacon — the token
 * travels in the body because beacons cannot set headers) and folds them into:
 *   videoSessions/{sessionId}  one row per viewing session
 *   videoStats/{videoKey}      lifetime totals per video (or lesson when no library video)
 *   courseStats/{courseId}     lifetime totals per course
 *   videoDaily/{YYYY-MM-DD}    totals per day, with per-provider bandwidth
 * Deltas are clamped so a stuck tab cannot inflate the numbers.
 */

const MAX_WATCH_PER_FLUSH = 90; // seconds; flushes are ~20s apart
const MAX_BYTES_PER_FLUSH = MAX_WATCH_PER_FLUSH * 1_000_000; // 8 Mbps ceiling

const num = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as (Partial<VideoDelta> & { token?: string }) | null;
  if (!body?.token || !body.sessionId || !body.courseId || !body.lessonId) {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(body.token)).uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const provider = body.provider === "stream" ? "stream" : "vdocipher";
  const videoKey = body.videoDocId || `lesson:${body.lessonId}`;

  const watchSec = num(body.watchSec, MAX_WATCH_PER_FLUSH);
  const estBytes = num(body.estBytes, MAX_BYTES_PER_FLUSH);
  const inc = {
    watchSec: FieldValue.increment(watchSec),
    plays: FieldValue.increment(num(body.plays, 20)),
    pauses: FieldValue.increment(num(body.pauses, 50)),
    seeks: FieldValue.increment(num(body.seeks, 100)),
    buffers: FieldValue.increment(num(body.buffers, 100)),
    bufferSec: FieldValue.increment(num(body.bufferSec, MAX_WATCH_PER_FLUSH)),
    estBytes: FieldValue.increment(estBytes),
  };
  const sessionInc = body.first ? FieldValue.increment(1) : FieldValue.increment(0);
  const completedInc = body.ended ? FieldValue.increment(1) : FieldValue.increment(0);
  const sessionRef = db.collection(collections.videoSessions).doc(String(body.sessionId).slice(0, 64));
  const sessionSnap = body.first ? null : await sessionRef.get();
  // Guard: a session id belongs to the user that created it.
  if (sessionSnap?.exists && sessionSnap.get("uid") !== uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Names are denormalised onto the stats docs the first time we see them so
  // the admin report never has to join.
  const statsRef = db.collection(collections.videoStats).doc(videoKey);
  const courseRef = db.collection(collections.courseStats).doc(body.courseId);
  const [statsSnap, courseStatSnap] = await Promise.all([statsRef.get(), courseRef.get()]);
  const names: Record<string, unknown> = {};
  if (!statsSnap.exists || !courseStatSnap.exists) {
    const [lesson, course, video] = await Promise.all([
      db.collection(collections.lessons).doc(body.lessonId).get(),
      db.collection(collections.course).doc(body.courseId).get(),
      body.videoDocId ? db.collection(collections.videos).doc(body.videoDocId).get() : null,
    ]);
    names.lessonName = lesson.get("name") ?? "";
    names.courseName = course.get("name") ?? "";
    names.instructorId = (course.get("authorRef") as { id?: string } | undefined)?.id ?? "";
    names.videoTitle = video?.get("title") ?? names.lessonName;
    names.videoDurationSec = Number(video?.get("duration") || lesson.get("videoDuration") || body.durationSec || 0);
  }

  const batch = db.batch();
  batch.set(
    sessionRef,
    {
      uid,
      courseId: body.courseId,
      lessonId: body.lessonId,
      chapterId: body.chapterId ?? null,
      videoKey,
      provider,
      device: String(body.device ?? "").slice(0, 20),
      connection: String(body.connection ?? "").slice(0, 20),
      locale: String(body.locale ?? "").slice(0, 5),
      qualityHeight: Math.max(num(body.qualityHeight, 4320), sessionSnap?.get("qualityHeight") ?? 0),
      playbackRate: num(body.playbackRate, 4) || 1,
      maxPositionSec: Math.max(num(body.maxPositionSec), sessionSnap?.get("maxPositionSec") ?? 0),
      durationSec: num(body.durationSec) || sessionSnap?.get("durationSec") || 0,
      ended: Boolean(body.ended) || Boolean(sessionSnap?.get("ended")),
      ...(body.first || !sessionSnap?.exists ? { startedAt: FieldValue.serverTimestamp(), day } : {}),
      lastAt: FieldValue.serverTimestamp(),
      ...inc,
    },
    { merge: true },
  );
  batch.set(
    statsRef,
    {
      videoKey,
      videoDocId: body.videoDocId ?? null,
      lessonId: body.lessonId,
      courseId: body.courseId,
      provider,
      ...names,
      sessions: sessionInc,
      completions: completedInc,
      // Nested maps merge field-by-field with { merge: true }; dotted keys would not.
      quality: { [String(Math.max(num(body.qualityHeight, 4320), 0) || "unknown")]: FieldValue.increment(watchSec) },
      device: { [String(body.device ?? "unknown").replace(/[^a-z]/gi, "") || "unknown"]: FieldValue.increment(watchSec) },
      lastAt: FieldValue.serverTimestamp(),
      ...inc,
    },
    { merge: true },
  );
  batch.set(
    courseRef,
    {
      courseId: body.courseId,
      ...(names.courseName !== undefined ? { courseName: names.courseName, instructorId: names.instructorId } : {}),
      sessions: sessionInc,
      completions: completedInc,
      lastAt: FieldValue.serverTimestamp(),
      ...inc,
    },
    { merge: true },
  );
  batch.set(
    db.collection(collections.videoDaily).doc(day),
    {
      day,
      sessions: sessionInc,
      bytes: { [provider]: FieldValue.increment(estBytes) },
      watchByProvider: { [provider]: FieldValue.increment(watchSec) },
      courses: { [body.courseId]: FieldValue.increment(watchSec) },
      ...inc,
    },
    { merge: true },
  );
  await batch.commit();
  return NextResponse.json({ ok: true });
}
