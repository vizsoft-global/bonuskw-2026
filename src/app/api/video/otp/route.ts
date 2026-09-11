import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import { canPlayLesson } from "@/lib/server/access";
import { lessonAccess } from "@/lib/course/entitlement";
import type { ChapterDoc, CourseDoc, LessonDoc, VideoDoc } from "@/lib/types/firestore";

export const runtime = "nodejs";

type Body = { lessonId?: string; courseId?: string };

/**
 * Hands out a playback ticket for one video.
 *
 * - `lessonId`: the enrolled student's lesson, or a free-preview lesson for
 *   anyone (signed in or not) so a course can be sampled before buying.
 * - `courseId`: the course's intro video, public by nature.
 */
export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  const body = (await req.json().catch(() => ({}))) as Body;
  const db = getAdminDb();

  if (body.courseId) {
    const courseSnap = await db.collection(collections.course).doc(body.courseId).get();
    const course = courseSnap.data() as CourseDoc | undefined;
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (!course.videoRef && !course.video) {
      return NextResponse.json({ error: "No intro video" }, { status: 404 });
    }
    return ticket(db, {
      videoRefId: course.videoRef?.id,
      videoId: course.video,
      annotate: await annotation(db, user),
    });
  }

  if (!body.lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

  let lesson: LessonDoc | undefined;
  if (user) {
    const access = await canPlayLesson(db, user.uid, body.lessonId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });
    lesson = access.lesson;
  } else {
    // Signed-out: only a lesson the instructor marked as a free preview.
    const lessonSnap = await db.collection(collections.lessons).doc(body.lessonId).get();
    if (!lessonSnap.exists) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    lesson = lessonSnap.data() as LessonDoc;
    const chapterId = lesson.chapterRef?.id;
    const chapterSnap = chapterId ? await db.collection(collections.chapter).doc(chapterId).get() : null;
    const chapter = chapterSnap?.exists ? (chapterSnap.data() as ChapterDoc) : null;
    if (lessonAccess({ lesson, chapter, subscription: null }) !== "preview") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return ticket(db, {
    videoRefId: lesson.videoRef?.id,
    videoId: lesson.video,
    annotate: await annotation(db, user),
  });
}

async function annotation(db: Firestore, user: { uid: string; phone_number?: string } | null) {
  if (!user) return "Preview";
  const profile = await db.collection(collections.users).doc(user.uid).get();
  return String(profile.get("display_name") || user.phone_number || user.uid);
}

async function ticket(
  db: Firestore,
  input: { videoRefId?: string; videoId?: string; annotate: string },
) {
  const videoSnap = input.videoRefId
    ? await db.collection(collections.videos).doc(input.videoRefId).get()
    : null;
  const video = videoSnap?.data() as VideoDoc | undefined;
  const videoId = video?.videoId || input.videoId;

  if (video?.provider === "stream" && video.cfId) {
    return NextResponse.json({
      provider: "stream",
      videoDocId: input.videoRefId ?? null,
      uid: video.cfId,
      domain: process.env.NEXT_PUBLIC_CF_STREAM_DOMAIN || "",
    });
  }

  const secret = process.env.VDOCIPHER_API_SECRET;
  if (!secret || !videoId) {
    return NextResponse.json({ error: "Video is not ready" }, { status: 501 });
  }

  const res = await fetch(
    `https://dev.vdocipher.com/api/videos/${encodeURIComponent(String(videoId))}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Apisecret ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ttl: 300,
        annotate: JSON.stringify([
          {
            type: "rtext",
            text: input.annotate,
            alpha: "0.6",
            color: "0xFFFFFF",
            size: "15",
            interval: "5000",
          },
        ]),
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { otp?: string; playbackInfo?: string };
  if (!res.ok || !json.otp) {
    return NextResponse.json({ error: "Could not start playback" }, { status: 502 });
  }
  return NextResponse.json({
    provider: "vdocipher",
    videoDocId: input.videoRefId ?? null,
    otp: json.otp,
    playbackInfo: json.playbackInfo,
  });
}
