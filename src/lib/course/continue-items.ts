import { formatDistanceToNow } from "date-fns";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import type { ContinueItem } from "@/components/home/continue-card";
import { getCourse, getDocsByIds, listLessons } from "@/lib/catalog/queries";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { courseThumb } from "@/lib/course/thumb";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn();
  }
  return null;
}

/**
 * Shared resume/progress loader for Home and My Space. Progress is derived
 * from `watchProgress` rows, but lesson docs often carry `videoDuration: 0`,
 * so runtimes fall back to the linked `videos` record's `durationSeconds`.
 * A lesson counts as done when flagged completed, or when accumulated watch
 * time passes 90% of its runtime — rows recorded back when durations were
 * always 0 recover as soon as the runtime is known.
 */
export async function loadContinueItems(
  uid: string,
  courseIds: Array<string | undefined>,
): Promise<ContinueItem[]> {
  const ids = courseIds.filter((id): id is string => Boolean(id)).slice(0, 8);
  if (!ids.length) return [];
  const db = getDb();
  const userRef = doc(db, collections.users, uid);
  // Resume state is a bonus: if it cannot be read, every course still shows
  // with 0% progress instead of blanking the whole section.
  let progress: Array<{
    courseId?: string;
    lessonId: string;
    completed: boolean;
    watchedSec: number;
    durationSec: number;
    updatedAt: Date | null;
  }> = [];
  try {
    const progressSnap = await getDocs(
      query(collection(db, collections.watchProgress), where("userRef", "==", userRef)),
    );
    progress = progressSnap.docs.map((d) => ({
      courseId: d.get("courseRef")?.id as string | undefined,
      lessonId: String(d.get("lessonId") || ""),
      completed: Boolean(d.get("completed")),
      watchedSec: Math.max(Number(d.get("watchedSec") || 0), Number(d.get("positionSec") || 0)),
      durationSec: Number(d.get("durationSec") || 0),
      updatedAt: toDate(d.get("updatedAt")),
    }));
  } catch {
    progress = [];
  }

  const rows: Array<ContinueItem | null> = await Promise.all(
    ids.map(async (courseId) => {
      const [course, lessons] = await Promise.all([getCourse(courseId), listLessons(courseId)]);
      if (!course) return null;
      const videoIds = [
        ...new Set(
          lessons
            .map((l) => (l.videoRef as { id?: string } | undefined)?.id)
            .filter((v): v is string => Boolean(v)),
        ),
      ];
      let videoDur: Record<string, number> = {};
      try {
        const videoDocs = videoIds.length ? await getDocsByIds(collections.videos, videoIds) : {};
        videoDur = Object.fromEntries(
          Object.entries(videoDocs).map(([vid, vdoc]) => [vid, Number(vdoc.durationSeconds || 0)]),
        );
      } catch {
        videoDur = {};
      }
      const lessonDur = (l: (typeof lessons)[number]) =>
        Number(l.videoDuration || 0) ||
        videoDur[(l.videoRef as { id?: string } | undefined)?.id ?? ""] ||
        0;
      const courseProgress = progress.filter((p) => p.courseId === courseId);
      const byLesson = new Map(courseProgress.map((p) => [p.lessonId, p]));
      const isDone = (lessonId: string, dur: number) => {
        const p = byLesson.get(lessonId);
        if (!p) return false;
        if (p.completed) return true;
        const effDur = p.durationSec > 0 ? p.durationSec : dur;
        return effDur > 0 && p.watchedSec / effDur >= 0.9;
      };
      const total = lessons.length || 1;
      const doneFlags = lessons.map((l) => isDone(l.id, lessonDur(l)));
      const done = doneFlags.filter(Boolean).length;
      const remaining = lessons.filter((_, i) => !doneFlags[i]);
      const hrsLeft = remaining.reduce((sum, l) => sum + lessonDur(l), 0) / 3600;
      const watchedMin = Math.round(
        lessons.reduce((sum, l) => {
          const p = byLesson.get(l.id);
          if (!p) return sum;
          const effDur = p.durationSec > 0 ? p.durationSec : lessonDur(l);
          return sum + Math.min(p.watchedSec, effDur > 0 ? effDur : p.watchedSec);
        }, 0) / 60,
      );
      const last = courseProgress.reduce<Date | null>((max, p) => {
        if (!p.updatedAt) return max;
        return !max || p.updatedAt > max ? p.updatedAt : max;
      }, null);
      return {
        courseId,
        name: course.name || "",
        image: courseThumb(course),
        pct: Math.round((done / total) * 100),
        hrsLeft: Math.max(hrsLeft >= 1 ? Math.round(hrsLeft) : Math.round(hrsLeft * 10) / 10, 0),
        watchedMin,
        nextName: remaining[0] ? String(remaining[0].name || "") : undefined,
        lastStudied: last ? formatDistanceToNow(last, { addSuffix: true }) : undefined,
        lastStudiedAt: last ? last.getTime() : undefined,
      };
    }),
  );
  return rows.filter((row): row is ContinueItem => row !== null);
}
