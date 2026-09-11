"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { ChapterSections } from "@/components/course/chapter-sections";
import { isPreviewable } from "@/components/course/file-art";
import { downloadFile, FilePreview } from "@/components/course/file-preview";
import { QuizPlayer } from "@/components/course/quiz-player";
import { ResourceList } from "@/components/course/resource-list";
import { HomeIcon } from "@/components/home/icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse, listChapters, listLessons, listQuizzes, listResources } from "@/lib/catalog/queries";
import { buildOutline, type OutlineFile } from "@/lib/course/outline";
import { useLessonVideoMeta } from "@/lib/course/use-lesson-posters";
import { useQuizResults } from "@/lib/course/use-quiz-results";
import { useCourseSubscription } from "@/lib/course/use-subscription";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import type { QuizDoc, UserDoc } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";
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
  const [mobileTab, setMobileTab] = useState<"lessons" | "resources">("lessons");
  const [previewFile, setPreviewFile] = useState<OutlineFile | null>(null);

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
  // Files shown next to the player: the lesson's own, then its chapter's.
  const currentFiles = [
    ...(currentLesson?.files ?? []),
    ...(currentChapter?.kind === "chapter" ? currentChapter.files : []),
  ];
  // Previous/next across every lesson the student can play, in outline order.
  const playable = outline.flatMap((item) =>
    item.kind === "chapter" ? item.lessons.filter((l) => !l.locked) : [],
  );
  const position = playable.findIndex((l) => l.id === lesson?.id);
  const prevLesson = position > 0 ? playable[position - 1] : undefined;
  const nextLesson = position >= 0 ? playable[position + 1] : undefined;

  function openFile(file: OutlineFile) {
    if (isPreviewable(file)) setPreviewFile(file);
    else downloadFile(file);
  }

  const courseName = String(course.data?.name || "");
  const instructorAction = instructor.data ? (
    <Link
      href={`/instructor/${instructor.data.id}`}
      className="flex min-w-0 items-center gap-0.5 text-[11px] text-[#999] lg:text-[12px]"
    >
      <span className="truncate">
        {t("byInstructor").replace("{name}", String(instructor.data.display_name || t("instructor")))}
      </span>
      <span className="size-3.5 shrink-0 rtl:-scale-x-100">
        <HomeIcon src="/course/chevron.svg" />
      </span>
    </Link>
  ) : undefined;

  const resourcesPanel = (
    <ResourceList files={currentFiles} onOpen={openFile} dense />
  );

  return (
    <AppShell
      loading={loading}
      compactHeader
      title={courseName || t("lessons")}
      actions={instructorAction}
      skeleton={<ListPageSkeleton rows={6} />}
    >
      {outline.length ? (
        <div className="learn-fit flex flex-col gap-2">
          <div className="flex min-h-0 flex-col gap-2 lg:flex-row lg:items-stretch">
            <div className={cn("min-w-0", !activeQuiz && "learn-player")}>
              {activeQuiz ? (
                <div className="learn-player overflow-auto rounded-[12px] border-[0.5px] border-white/10 bg-[#141414] p-4">
                  <p className="mb-3 text-[16px] font-semibold text-[#fafafa]">{String(activeQuiz.name || t("test"))}</p>
                  {activeQuiz.status === false || subscription.data?.status !== "Ongoing" ? (
                    <p className="text-[13px] text-[#999]">{t("testLocked")}</p>
                  ) : (
                    <QuizPlayer key={activeQuiz.id} quiz={activeQuiz} onExit={() => lesson && openLesson(lesson.id)} />
                  )}
                </div>
              ) : (
                <div
                  className="relative h-full w-full overflow-hidden rounded-[12px] border-[0.5px] border-white/10"
                  style={{ background: "#1d1d1d" }}
                >
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
                    <button
                      type="button"
                      onClick={() => void play()}
                      className="grid h-full w-full place-items-center"
                      style={{ color: "#fff" }}
                    >
                      {t("start")}
                    </button>
                  )}
                  {/* Title strip and previous/next lesson, over the top edge of the video. */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[58px] lg:h-[72px]"
                    style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)" }}
                  />
                  <div className="pointer-events-none absolute start-3 top-2.5 lg:start-5 lg:top-4">
                    <p className="text-[12px] font-medium leading-4 lg:text-[15px] lg:leading-5" style={{ color: "#fafafa" }}>
                      {String(lesson?.name || courseName)}
                    </p>
                    <p className="text-[10px] leading-4 lg:text-[11px]" style={{ color: "rgba(250,250,250,0.6)" }}>
                      {courseName}
                    </p>
                  </div>
                  <div className="absolute end-3 top-2.5 flex items-center gap-1.5 lg:end-5 lg:top-4">
                    {prevLesson ? (
                      <button
                        type="button"
                        onClick={() => openLesson(prevLesson.id)}
                        className="flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-medium backdrop-blur-sm lg:h-8 lg:px-3 lg:text-[12px]"
                        style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                      >
                        <SkipIcon direction="back" />
                        <span className="hidden sm:inline">{t("previousLessonBtn")}</span>
                      </button>
                    ) : null}
                    {nextLesson ? (
                      <button
                        type="button"
                        onClick={() => openLesson(nextLesson.id)}
                        className="flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-medium backdrop-blur-sm lg:h-8 lg:px-3 lg:text-[12px]"
                        style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                      >
                        {t("nextLessonBtn")}
                        <SkipIcon direction="forward" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop: the playing lesson's files beside the video. */}
            <aside className="learn-resources hidden min-w-0 lg:flex">
              <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-[12px] border-[0.5px] border-white/10 bg-[#141414]">
                <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                  <p className="text-[13px] font-medium text-[#fafafa]">{t("resources")}</p>
                  <p className="text-[11px] text-[#999]">{t("assetsCount").replace("{n}", String(currentFiles.length))}</p>
                </div>
                <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-2">{resourcesPanel}</div>
              </div>
            </aside>
          </div>

          {/* Mobile: tabs between what to watch next and the files. */}
          <div className="lg:hidden">
            <div className="flex items-center gap-[15px] border-b border-white/20">
              {(["lessons", "resources"] as const).map((key) => {
                const active = mobileTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMobileTab(key)}
                    className={cn(
                      "flex items-center gap-[5px] border-b px-[5px] py-2.5 text-[12px] text-[#fafafa]",
                      active ? "border-[#fafafa] font-medium" : "border-transparent opacity-60",
                    )}
                  >
                    {key === "lessons" ? t("nextLessons") : t("resources")}
                    {key === "resources" ? (
                      <span className="rounded-[6px] bg-[#141414] px-2 text-[10px] font-medium leading-4 text-[#fafafa]">
                        {currentFiles.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {mobileTab === "resources" ? (
              <ResourceList files={currentFiles} onOpen={openFile} />
            ) : (
              <ChapterSections
                items={outline}
                locale={locale}
                activeId={quizId || lesson?.id}
                quizResults={quizResults.data}
                headerTone="muted"
                dense
                onLesson={(next) => openLesson(next.id)}
                onQuiz={openQuiz}
                onFile={openFile}
              />
            )}
          </div>

          {/* Desktop: what to watch next, chapter by chapter. */}
          <section className="hidden min-h-0 lg:block">
            <h2 className="text-[13px] font-semibold text-[#fafafa]">{t("nextLessons")}</h2>
            <ChapterSections
              items={outline}
              locale={locale}
              activeId={quizId || lesson?.id}
              quizResults={quizResults.data}
              headerTone="muted"
              dense
              onLesson={(next) => openLesson(next.id)}
              onQuiz={openQuiz}
              onFile={openFile}
            />
          </section>

          <div className="flex items-center gap-3 rounded-[12px] bg-[#141414] px-3 py-2.5 text-[12px] text-[#fafafa]">
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
              className="h-8 rounded-full bg-[#0c5eff] px-3 text-[12px] font-semibold text-white"
              onClick={() => void leaveReview()}
            >
              {t("finish")}
            </button>
          </div>
        </div>
      ) : (
        <EmptyState icon="/course/play.svg" title={t("emptyLessonsTitle")} body={t("emptyLessonsBody")} />
      )}
      {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
    </AppShell>
  );
}

/** Skip-to-next / skip-to-previous glyph for the player overlay. */
function SkipIcon({ direction }: { direction: "forward" | "back" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-3.5", direction === "back" ? "-scale-x-100 rtl:scale-x-100" : "rtl:-scale-x-100")}
      fill="currentColor"
      aria-hidden
    >
      <path d="M5 5.5v13l9-6.5z" />
      <rect x="16" y="5.5" width="2.5" height="13" rx="0.8" />
    </svg>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-app-top" />}>
      <LearnBody />
    </Suspense>
  );
}
