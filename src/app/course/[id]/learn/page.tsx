"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse, listChapters, listLessons, listQuizzes } from "@/lib/catalog/queries";
import { getDb, getFns } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function LearnPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const lessons = useQuery({ queryKey: ["lessons", id], queryFn: () => listLessons(id) });
  const chapters = useQuery({ queryKey: ["chapters", id], queryFn: () => listChapters(id) });
  const quizzes = useQuery({ queryKey: ["quizzes", id], queryFn: () => listQuizzes(id) });
  const course = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const [lessonId, setLessonId] = useState(params.get("lesson") || "");
  const [otp, setOtp] = useState<{ otp?: string; playbackInfo?: string; provider?: string; uid?: string } | null>(null);
  const [score, setScore] = useState<string>("");
  const [review, setReview] = useState(5);

  const lesson = (lessons.data ?? []).find((item) => item.id === lessonId) || lessons.data?.[0];

  useEffect(() => {
    if (lesson && !lessonId) setLessonId(lesson.id);
  }, [lesson, lessonId]);

  useEffect(() => {
    if (!user || !lesson) return;
    let last = 0;
    const tick = window.setInterval(() => {
      void user.getIdToken().then((token) =>
        fetch("/api/progress", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId: lesson.id,
            courseId: id,
            chapterId: (lesson.chapterRef as { id?: string } | undefined)?.id,
            positionSec: last + 15,
            durationSec: Number(lesson.videoDuration || 0),
            deltaSec: 15,
          }),
        }),
      );
      last += 15;
    }, 15000);
    return () => window.clearInterval(tick);
  }, [user, lesson, id]);

  async function play() {
    if (!user || !lesson) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/video/otp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson.id }),
    });
    setOtp(await res.json());
  }

  async function submitQuiz(quizId: string) {
    const fn = httpsCallable(getFns(), "submitQuizAttempt");
    const result = await fn({ quizId, answers: {} });
    setScore(JSON.stringify(result.data));
  }

  async function leaveReview() {
    if (!user) return;
    await addDoc(collection(getDb(), collections.review), {
      userRef: doc(getDb(), collections.users, user.uid),
      courseRef: doc(getDb(), collections.course, id),
      rating: review,
      review: "Completed",
      createdAt: serverTimestamp(),
    });
  }

  const src =
    otp?.provider === "vdocipher" && otp.otp
      ? `https://player.vdocipher.com/v2/?otp=${otp.otp}&playbackInfo=${otp.playbackInfo}`
      : otp?.provider === "stream" && otp.uid
        ? `https://${process.env.NEXT_PUBLIC_CF_STREAM_DOMAIN || "customer.cloudflarestream.com"}/${otp.uid}/iframe`
        : "";

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.7fr]">
        <div className="lg:sticky lg:top-24">
          <div className="aspect-video overflow-hidden rounded-3xl bg-black">
            {src ? (
              <iframe title={String(lesson?.name || "Lesson")} src={src} className="h-full w-full" allow="fullscreen" />
            ) : (
              <button type="button" onClick={() => void play()} className="grid h-full w-full place-items-center text-white">
                {t("start")}
              </button>
            )}
          </div>
          <p className="mt-3 font-medium">{String(lesson?.name || course.data?.name || "")}</p>
        </div>
        <aside className="max-h-[70vh] overflow-y-auto rounded-3xl border border-line p-3">
          {(chapters.data ?? []).map((chapter) => (
            <div key={chapter.id} className="mb-3">
              <p className="text-sm font-medium">{String(chapter.name)}</p>
              {(lessons.data ?? [])
                .filter((item) => (item.chapterRef as { id?: string } | undefined)?.id === chapter.id)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setLessonId(item.id);
                      setOtp(null);
                    }}
                    className={`mt-1 block w-full rounded-xl px-2 py-2 text-start text-sm ${item.id === lesson?.id ? "bg-primary/15" : ""}`}
                  >
                    {String(item.name)}
                  </button>
                ))}
            </div>
          ))}
          {(quizzes.data ?? []).map((quiz) => (
            <button key={quiz.id} type="button" className="mt-2 text-sm text-primary" onClick={() => void submitQuiz(quiz.id)}>
              {String(quiz.name || t("tests"))}
            </button>
          ))}
          {score ? <p className="mt-2 text-xs">{score}</p> : null}
          <label className="mt-4 block text-sm">
            {t("rating")}
            <input type="number" min={1} max={5} value={review} onChange={(e) => setReview(Number(e.target.value))} className="ms-2 w-16 bg-transparent" />
          </label>
          <button type="button" className="mt-2 text-sm" onClick={() => void leaveReview()}>
            {t("finish")}
          </button>
        </aside>
      </div>
    </AppShell>
  );
}
