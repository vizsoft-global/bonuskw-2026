"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { InstructorCard } from "@/components/course/instructor-card";
import { ChapterSections } from "@/components/course/chapter-sections";
import { QuizPlayer } from "@/components/course/quiz-player";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse, listChapters, listLessons, listQuizzes, listResources } from "@/lib/catalog/queries";
import { buildOutline } from "@/lib/course/outline";
import { useLessonVideoMeta } from "@/lib/course/use-lesson-posters";
import { useQuizResults } from "@/lib/course/use-quiz-results";
import { useCourseSubscription } from "@/lib/course/use-subscription";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import type { QuizDoc, UserDoc } from "@/lib/types/firestore";
import { VideoTracker } from "@/lib/analytics/video-tracker";
import { playerSrc, type PlaybackTicket } from "@/lib/video/player-src";

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
  const quizResults = useQuizResults(id, user?.uid);
  const videoMeta = useLessonVideoMeta(lessons.data);
  // Real runtimes from the video records: lesson docs often carry
  // `videoDuration: 0`, which used to blank every readout and block progress.
  const durations = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [lessonId, meta] of Object.entries(videoMeta.data ?? {})) {
      if (meta.durationSec) out[lessonId] = meta.durationSec;
    }
    return out;
  }, [videoMeta.data]);
  const posters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [lessonId, meta] of Object.entries(videoMeta.data ?? {})) {
      if (meta.poster) out[lessonId] = meta.poster;
    }
    return out;
  }, [videoMeta.data]);
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
  const [otp, setOtp] = useState<PlaybackTicket | null>(null);
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
        posters,
        durations,
        locale,
      }),
    [chapters.data, lessons.data, quizzes.data, resources.data, subscription.data, posters, durations, locale],
  );

  // Fall back to the first lesson until one is chosen; no effect needed.
  const lesson = (lessons.data ?? []).find((item) => item.id === lessonId) || lessons.data?.[0];
  const activeQuiz = quizId ? ((quizzes.data ?? []).find((q) => q.id === quizId) as (QuizDoc & { id: string }) | undefined) : undefined;
  const lessonDuration = Number(lesson?.videoDuration || (lesson ? durations[lesson.id] : 0) || 0);

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
            durationSec: lessonDuration,
            deltaSec: 15,
          }),
        }),
      );
      last += 15;
    }, 15000);
    return () => window.clearInterval(tick);
    // lessonDuration restarts the ticker once real runtimes resolve, so the
    // posted duration (and completion) is truthful from the first tick.
  }, [user, lesson, lessonDuration, id, quizId]);

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
        durationSec: lessonDuration || undefined,
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
  // The fetch waits a beat so hopping across lessons fires one OTP request
  // for the lesson the student settles on, and an in-flight request is
  // aborted when they move on before it resolves.
  useEffect(() => {
    // Note: otpBusy is intentionally not part of the guard — an aborted run
    // must never block the run for the newly selected lesson.
    if (!user || !lesson || quizId || otp) return;
    const targetId = lesson.id;
    const getToken = () => user.getIdToken();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      async function autoplay() {
        setOtpBusy(true);
        try {
          const token = await getToken();
          const res = await fetch("/api/video/otp", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId: targetId }),
            signal: controller.signal,
          });
          const json = await res.json();
          setOtp(json);
        } catch (err) {
          // Aborts and network blips keep the Start button as the fallback.
          if ((err as Error)?.name !== "AbortError") {
            setOtpBusy(false);
          }
        }
      }
      void autoplay().finally(() => {
        if (!controller.signal.aborted) setOtpBusy(false);
      });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
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

  const src = playerSrc(otp);

  const loading = lessons.isPending || course.isPending || chapters.isPending;

  const currentChapter = outline.find(
    (item) => item.kind === "chapter" && item.lessons.some((l) => l.id === lesson?.id),
  );
  const currentLesson =
    currentChapter?.kind === "chapter" ? currentChapter.lessons.find((l) => l.id === lesson?.id) : undefined;

  return (
    <AppShell loading={loading} title={String(course.data?.name || t("lessons"))} skeleton={<ListPageSkeleton rows={6} />}>
      {outline.length ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <div className="min-w-0">
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
                </>
              )}
            </div>
            <aside className="flex min-w-0 flex-col gap-3">
              {!activeQuiz ? (
                <div className="rounded-[16px] bg-[#141414] p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#999]">{t("currentlyPlaying")}</p>
                  <p className="mt-1 text-[15px] font-semibold leading-5 text-[#fafafa]">
                    {String(lesson?.name || course.data?.name || "")}
                  </p>
                  {currentChapter?.kind === "chapter" ? (
                    <p className="mt-0.5 truncate text-[12px] text-[#999]">{currentChapter.name}</p>
                  ) : null}
                  {currentLesson?.files.length ? (
                    <ul className="mt-2 flex flex-col divide-y divide-white/10">
                      {currentLesson.files.map((file) => (
                        <li key={file.id}>
                          <button
                            type="button"
                            disabled={file.locked}
                            onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}
                            className="flex min-h-10 w-full items-center gap-2 py-1.5 text-start disabled:opacity-60"
                          >
                            <span className="min-w-0 flex-1 truncate text-[12px] text-[#fafafa]">{file.name}</span>
                            <span className="shrink-0 text-[11px] font-medium text-[#0c5eff]">
                              {file.locked ? "" : t("download")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {instructor.data ? (
                <div className="[&>a]:mt-0">
                  <InstructorCard
                    href={`/instructor/${instructor.data.id}`}
                    name={String(instructor.data.display_name || t("instructor"))}
                    bio={instructor.data.bio}
                    photo={instructor.data.photo_url}
                    rating={Number(course.data?.totalRatting || 0)}
                    ratingLabel={t("rating")}
                    verified={instructor.data.instuctorStatus === "Approved"}
                  />
                </div>
              ) : null}
              <div className="rounded-[16px] bg-[#141414] p-3 text-[13px] text-[#fafafa]">
                <label className="flex items-center gap-2">
                  {t("rating")}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={review}
                    onChange={(e) => setReview(Number(e.target.value))}
                    className="w-14 rounded-md bg-white/10 px-2 py-1 text-center"
                  />
                </label>
                <button
                  type="button"
                  className="mt-2 h-8 rounded-full bg-[#0c5eff] px-3 text-[12px] font-semibold text-white"
                  onClick={() => void leaveReview()}
                >
                  {t("finish")}
                </button>
              </div>
            </aside>
          </div>
          <section>
            <h2 className="pb-1 text-[16px] font-semibold text-[#fafafa]">{t("nextLessons")}</h2>
            <ChapterSections
              items={outline}
              locale={locale}
              activeId={quizId || lesson?.id}
              quizResults={quizResults.data}
              onLesson={(next) => openLesson(next.id)}
              onQuiz={openQuiz}
            />
          </section>
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
