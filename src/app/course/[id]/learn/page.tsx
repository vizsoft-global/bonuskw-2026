"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { FileTile } from "@/components/course/outline";
import { InstructorCard } from "@/components/course/instructor-card";
import { LearnAside } from "@/components/course/learn-aside";
import { QuizPlayer } from "@/components/course/quiz-player";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse, listChapters, listLessons, listQuizzes, listResources } from "@/lib/catalog/queries";
import { buildOutline } from "@/lib/course/outline";
import { useLessonPosters } from "@/lib/course/use-lesson-posters";
import { useCourseSubscription } from "@/lib/course/use-subscription";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import type { QuizDoc, UserDoc } from "@/lib/types/firestore";
import { VideoTracker } from "@/lib/analytics/video-tracker";

function LearnBody() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const lessons = useQuery({ queryKey: ["lessons", id], queryFn: () => listLessons(id) });
  const chapters = useQuery({ queryKey: ["chapters", id], queryFn: () => listChapters(id) });
  const quizzes = useQuery({ queryKey: ["quizzes", id], queryFn: () => listQuizzes(id) });
  const resources = useQuery({ queryKey: ["resources", id], queryFn: () => listResources(id) });
  const course = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const subscription = useCourseSubscription(id, user?.uid);
  const posters = useLessonPosters(lessons.data);
  const instructor = useQuery({
    queryKey: ["instructor", course.data?.authorRef?.id],
    enabled: Boolean(course.data?.authorRef?.id),
    queryFn: async () => {
      const snap = await getDoc(course.data!.authorRef!);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as UserDoc) }) : null;
    },
  });

  const [lessonId, setLessonId] = useState(params.get("lesson") || "");
  const [quizId, setQuizId] = useState(params.get("quiz") || "");
  const [otp, setOtp] = useState<{ otp?: string; playbackInfo?: string; provider?: string; uid?: string; videoDocId?: string | null } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [review, setReview] = useState(5);

  const outline = useMemo(
    () =>
      buildOutline({
        chapters: chapters.data ?? [],
        lessons: lessons.data ?? [],
        quizzes: quizzes.data ?? [],
        resources: resources.data ?? [],
        subscription: subscription.data ?? null,
        posters: posters.data,
        locale,
      }),
    [chapters.data, lessons.data, quizzes.data, resources.data, subscription.data, posters.data, locale],
  );

  // Fall back to the first lesson until one is chosen; no effect needed.
  const lesson = (lessons.data ?? []).find((item) => item.id === lessonId) || lessons.data?.[0];
  const activeQuiz = quizId ? ((quizzes.data ?? []).find((q) => q.id === quizId) as (QuizDoc & { id: string }) | undefined) : undefined;
  const lessonFiles = useMemo(() => {
    for (const item of outline) {
      if (item.kind !== "chapter") continue;
      const hit = item.lessons.find((l) => l.id === lesson?.id);
      if (hit) return hit.files;
    }
    return [];
  }, [outline, lesson?.id]);

  useEffect(() => {
    if (!user || !lesson || quizId) return;
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
  }, [user, lesson, id, quizId]);

  // Playback analytics: pauses, seeks, buffering, watched time, estimated bandwidth.
  useEffect(() => {
    if (!user || !lesson || !otp?.provider || quizId) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const tracker = new VideoTracker(
      {
        courseId: id,
        lessonId: lesson.id,
        chapterId: (lesson.chapterRef as { id?: string } | undefined)?.id,
        videoDocId: otp.videoDocId ?? undefined,
        provider: otp.provider === "stream" ? "stream" : "vdocipher",
        durationSec: Number(lesson.videoDuration || 0) || undefined,
        locale,
      },
      () => user.getIdToken(),
    );
    const start = () => void tracker.attach(iframe);
    if (iframe.contentWindow && iframe.dataset.loaded === "1") start();
    else iframe.addEventListener("load", start, { once: true });
    return () => {
      iframe.removeEventListener("load", start);
      tracker.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-attach only when the video changes
  }, [user, lesson?.id, otp?.provider, otp?.otp, otp?.uid, quizId]);

  async function play() {
    if (!user || !lesson) return;
    setOtpBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/video/otp", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      setOtp(await res.json());
    } finally {
      setOtpBusy(false);
    }
  }

  // Opening a lesson starts playback straight away — no second tap on Start.
  // Runs for the first lesson too: landing on the learn page means watch.
  useEffect(() => {
    if (!user || !lesson || quizId || otp || otpBusy) return;
    let cancelled = false;
    setOtpBusy(true);
    void user
      .getIdToken()
      .then((token) =>
        fetch("/api/video/otp", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id }),
        }),
      )
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setOtp(json);
      })
      .catch(() => {
        // The Start button stays as the fallback.
      })
      .finally(() => {
        if (!cancelled) setOtpBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoplay only when the lesson changes
  }, [user, lesson?.id, quizId]);

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

  function openLesson(nextId: string) {
    setQuizId("");
    setLessonId(nextId);
    setOtp(null);
    router.replace(`/course/${id}/learn?lesson=${nextId}`);
  }

  function openQuiz(nextId: string) {
    setQuizId(nextId);
    setOtp(null);
    router.replace(`/course/${id}/learn?quiz=${nextId}`);
  }

  const src =
    otp?.provider === "vdocipher" && otp.otp
      ? `https://player.vdocipher.com/v2/?otp=${otp.otp}&playbackInfo=${otp.playbackInfo}`
      : otp?.provider === "stream" && otp.uid
        ? `https://${process.env.NEXT_PUBLIC_CF_STREAM_DOMAIN || "customer.cloudflarestream.com"}/${otp.uid}/iframe`
        : "";

  const loading = lessons.isPending || course.isPending || chapters.isPending;

  return (
    <AppShell loading={loading} title={String(course.data?.name || t("lessons"))} skeleton={<ListPageSkeleton rows={6} />}>
      {outline.length ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.7fr]">
          <div className="lg:sticky lg:top-24">
            {activeQuiz ? (
              <div className="rounded-[16px] border border-white/10 p-4 lg:rounded-3xl">
                <p className="mb-3 text-[16px] font-semibold text-[#fafafa]">{String(activeQuiz.name || t("test"))}</p>
                {activeQuiz.status === false || subscription.data?.status !== "Ongoing" ? (
                  <p className="text-[13px] text-[#999]">{t("testLocked")}</p>
                ) : (
                  <QuizPlayer key={activeQuiz.id} quiz={activeQuiz} onExit={() => lesson && openLesson(lesson.id)} />
                )}
              </div>
            ) : (
              <>
                <div className="aspect-video overflow-hidden rounded-[16px] bg-black lg:rounded-3xl">
                  {src ? (
                    <iframe
                      ref={iframeRef}
                      key={src}
                      title={String(lesson?.name || "Lesson")}
                      src={src}
                      className="h-full w-full"
                      allow="fullscreen; autoplay; encrypted-media"
                      onLoad={(e) => {
                        e.currentTarget.dataset.loaded = "1";
                      }}
                    />
                  ) : otpBusy ? (
                    <div className="grid h-full w-full place-items-center">
                      <Loader size="page" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => void play()} className="grid h-full w-full place-items-center text-white">
                      {t("start")}
                    </button>
                  )}
                </div>
                <p className="mt-3 font-medium">{String(lesson?.name || course.data?.name || "")}</p>
                {instructor.data ? (
                  <InstructorCard
                    href={`/instructor/${instructor.data.id}`}
                    name={String(instructor.data.display_name || t("instructor"))}
                    bio={instructor.data.bio}
                    photo={instructor.data.photo_url}
                    rating={Number(course.data?.totalRatting || 0)}
                    ratingLabel={t("rating")}
                    verified={instructor.data.instuctorStatus === "Approved"}
                  />
                ) : null}
                {lessonFiles.length ? (
                  <div className="mt-3 rounded-[14px] border border-white/10 p-2">
                    <p className="px-2 pb-1 text-[12px] font-medium text-[#999]">{t("attachments")}</p>
                    {lessonFiles.map((file) => (
                      <FileTile key={file.id} file={file} downloadLabel={t("download")} compact />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <aside className="overflow-y-auto rounded-[16px] border border-line lg:max-h-[70vh] lg:rounded-3xl">
            <LearnAside
              items={outline}
              activeLessonId={quizId ? undefined : lesson?.id}
              activeQuizId={quizId || undefined}
              current={
                lesson && !quizId
                  ? {
                      thumb:
                        typeof lesson.image === "string"
                          ? lesson.image
                          : posters.data?.[lesson.id],
                      title: String(lesson.name || ""),
                      duration: Number(lesson.videoDuration || 0),
                    }
                  : null
              }
              labels={{
                currentlyPlaying: t("currentlyPlaying"),
                nextLessons: t("nextLessons"),
                resources: t("resources"),
                download: t("download"),
                test: t("test"),
                tests: t("tests"),
                questions: t("questions"),
                minShort: t("minShort"),
              }}
              onLesson={openLesson}
              onQuiz={openQuiz}
            />
            <label className="mt-4 block text-sm">
              {t("rating")}
              <input type="number" min={1} max={5} value={review} onChange={(e) => setReview(Number(e.target.value))} className="ms-2 w-16 bg-transparent" />
            </label>
            <button type="button" className="mt-2 text-sm" onClick={() => void leaveReview()}>
              {t("finish")}
            </button>
          </aside>
        </div>
      ) : (
        <EmptyState icon="/course/play.svg" title={t("emptyLessonsTitle")} body={t("emptyLessonsBody")} />
      )}
    </AppShell>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-app-top" />}>
      <LearnBody />
    </Suspense>
  );
}
