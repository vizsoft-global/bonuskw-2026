import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import { canPlayLesson } from "@/lib/server/access";
import type { VideoDoc } from "@/lib/types/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { lessonId?: string };
  if (!body.lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

  const db = getAdminDb();
  const access = await canPlayLesson(db, user.uid, body.lessonId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 });

  const videoRef = access.lesson.videoRef;
  const videoSnap = videoRef
    ? await db.collection(collections.videos).doc(videoRef.id).get()
    : null;
  const video = videoSnap?.data() as VideoDoc | undefined;
  const videoId = video?.videoId || access.lesson.video;
  const profile = await db.collection(collections.users).doc(user.uid).get();
  const annotate = String(profile.get("display_name") || user.phone_number || user.uid);

  if (video?.provider === "stream" && video.cfId) {
    return NextResponse.json({
      provider: "stream",
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
            text: annotate,
            alpha: "0.6",
            color: "0xFFFFFF",
            size: "15",
            interval: "5000",
          },
        ]),
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    otp?: string;
    playbackInfo?: string;
  };
  if (!res.ok || !json.otp) {
    return NextResponse.json({ error: "Could not start playback" }, { status: 502 });
  }
  return NextResponse.json({ provider: "vdocipher", otp: json.otp, playbackInfo: json.playbackInfo });
}
