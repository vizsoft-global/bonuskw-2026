import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * One row per playback failure, so the "some students cannot play" cohort is
 * countable. A ticket failure can happen before sign-in (free preview), so the
 * token is optional — an unreadable token is recorded as anonymous rather than
 * rejected, because the report is worth more than the identity.
 */
const STAGES = new Set(["ticket", "load", "player", "expired"]);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | (Record<string, unknown> & { token?: string })
    | null;
  if (!body) return NextResponse.json({ error: "Bad payload" }, { status: 400 });

  const stage = str(body.stage, 16);
  if (!STAGES.has(stage)) return NextResponse.json({ error: "Bad stage" }, { status: 400 });

  let uid: string | null = null;
  if (body.token) {
    try {
      uid = (await getAdminAuth().verifyIdToken(String(body.token))).uid;
    } catch {
      uid = null;
    }
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  await getAdminDb()
    .collection(collections.videoErrors)
    .add({
      stage,
      message: str(body.message, 300),
      code: str(body.code, 80),
      detail: str(body.detail, 500),
      status: typeof body.status === "number" && Number.isFinite(body.status) ? body.status : null,
      courseId: str(body.courseId, 64) || null,
      lessonId: str(body.lessonId, 64) || null,
      chapterId: str(body.chapterId, 64) || null,
      provider: str(body.provider, 16) || null,
      uid,
      anon: !uid,
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 400),
      clientAt: typeof body.at === "number" ? body.at : null,
      day,
      createdAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ ok: true });
}
