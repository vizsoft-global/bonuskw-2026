"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { CourseHeaderActions } from "@/components/course/header-actions";
import { CourseCover, CourseInfo } from "@/components/course/hero";
import { EnrollCta } from "@/components/course/enroll-cta";
import { InstructorCard } from "@/components/course/instructor-card";
import { ChapterSections } from "@/components/course/chapter-sections";
import { isPreviewable } from "@/components/course/file-art";
import { downloadFile, FilePreview } from "@/components/course/file-preview";
import { VideoPopup } from "@/components/course/video-popup";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseDetailsSkeleton } from "@/components/shared/skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { canPurchase } from "@/lib/auth/purchase-access";
import { EnrolledCta, StaffViewOnlyNotice } from "@/components/course/enrolled-cta";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getBatch, getCourse, listChapters, listLessons, listQuizzes, listResources } from "@/lib/catalog/queries";
import { enrolmentBlock } from "@/lib/course/enrol";
import { courseEmiAmounts, courseEmiCount, splitEmi } from "@/lib/course/emi";
import { buildOutline, outlineCounts, type OutlineFile, type OutlineLesson } from "@/lib/course/outline";
import { invalidateEnrolment } from "@/lib/course/invalidate";
import { useLessonVideoMeta } from "@/lib/course/use-lesson-posters";
import { useQuizResults } from "@/lib/course/use-quiz-results";
import { useCourseSubscription } from "@/lib/course/use-subscription";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { UserDoc } from "@/lib/types/firestore";
import { playerSrc, requestPlayback, type PlaybackTicket } from "@/lib/video/player-src";
import { avatarSrc } from "@/lib/avatar";
import { courseThumb } from "@/lib/course/thumb";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile, ready } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cartError, setCartError] = useState("");
  const [preview, setPreview] = useState<OutlineLesson | null>(null);
  const [previewFile, setPreviewFile] = useState<OutlineFile | null>(null);
  const [intro, setIntro] = useState<PlaybackTicket | null>(null);
  const [introBusy, setIntroBusy] = useState(false);
  const course = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const batch = useQuery({
    queryKey: ["batch", course.data?.batchesRef?.id],
    queryFn: () => getBatch(course.data?.batchesRef?.id),
    enabled: Boolean(course.data?.batchesRef?.id),
  });
  const chapters = useQuery({ queryKey: ["chapters", id], queryFn: () => listChapters(id) });
  const lessons = useQuery({ queryKey: ["lessons", id], queryFn: () => listLessons(id) });
  const quizzes = useQuery({ queryKey: ["quizzes", id], queryFn: () => listQuizzes(id) });
  const resources = useQuery({ queryKey: ["resources", id], queryFn: () => listResources(id) });
  const videoMeta = useLessonVideoMeta(lessons.data);
  const subscription = useCourseSubscription(id, user?.uid);
  const quizResults = useQuizResults(id, user?.uid);
  const instructor = useQuery({
    queryKey: ["instructor", course.data?.authorRef?.id],
    enabled: Boolean(course.data?.authorRef?.id),
    queryFn: async () => {
      const snap = await getDoc(course.data!.authorRef!);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as UserDoc) }) : null;
    },
  });

  const title = course.data
    ? localizedField(course.data.name, course.data.nameManualTranslate, course.data.nameAutoTranslate, locale)
    : "";
  const saved = Boolean(profile?.fvrtCourseList?.some((ref) => ref.id === id));

  async function toggleSave() {
    if (!user) return;
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      fvrtCourseList: saved
        ? arrayRemove(doc(getDb(), collections.course, id))
        : arrayUnion(doc(getDb(), collections.course, id)),
    });
    await refreshProfile();
  }

  async function addCart(paymentType: "Full payment" | "EMI") {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!course.data) return;
    const c = course.data;
    setBusy(true);
    setCartError("");
    try {
      if (c.coursePaymentType === "Free") {
        const token = await user.getIdToken();
        await fetch("/api/enrol/free", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: id }),
        });
        await invalidateEnrolment(qc);
        router.push(`/course/${id}/learn`);
        return;
      }
      const cart = await loadCart(user.uid);
      await saveCart(
        user.uid,
        upsertLine(cart, {
          kind: "course",
          courseId: id,
          paymentType,
          title: c.name,
          image: courseThumb(c),
          price: Number(c.price) || 0,
          emiAvailable: Boolean(c.emiPaymentStatus),
          ...(c.emiPaymentStatus
            ? { emiCount: courseEmiCount(c), emiAmounts: emiPlan(c) }
            : {}),
          ...(batch.data?.name ? { batch: batch.data.name } : {}),
          addedAt: Date.now(),
        }),
      );
      router.push("/cart");
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
  }

  /** Single-chapter purchase: same cart flow as the course, one chapter line. */
  async function addChapterToCart(chapterId: string) {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const c = course.data;
    const chapter = chapters.data?.find((row) => row.id === chapterId) as
      | { name?: string; price?: number }
      | undefined;
    if (!c || !chapter) return;
    setBusy(true);
    setCartError("");
    try {
      const cart = await loadCart(user.uid);
      await saveCart(
        user.uid,
        upsertLine(cart, {
          kind: "chapter",
          courseId: id,
          chapterId,
          paymentType: "Full payment",
          title: `${c.name ?? ""} › ${chapter.name ?? ""}`.trim(),
          image: courseThumb(c),
          price: Number(chapter.price) || 0,
          ...(batch.data?.name ? { batch: batch.data.name } : {}),
          addedAt: Date.now(),
        }),
      );
      router.push("/cart");
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
  }

  /** The course's intro video replaces the thumbnail once a ticket arrives. */
  async function playIntro() {
    if (introBusy || intro) return;
    setIntroBusy(true);
    try {
      const token = user ? await user.getIdToken() : null;
      const ticket = await requestPlayback({ courseId: id }, token);
      if (playerSrc(ticket)) setIntro(ticket);
    } finally {
      setIntroBusy(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: title || course.data?.name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled share */
    }
  }

  const actions = (
    <CourseHeaderActions
      saved={saved}
      onShare={() => void share()}
      onSave={() => void toggleSave()}
      shareLabel={t("share")}
      saveLabel={saved ? t("saved") : t("bookmark")}
    />
  );

  if (course.isPending) {
    return <AppShell loading compactHeader title={title} actions={actions} skeleton={<CourseDetailsSkeleton />} />;
  }
  if (!course.data) {
    return (
      <AppShell compactHeader title={title} actions={actions}>
        <EmptyState
          icon="/course/book.svg"
          title={t("emptyCourseTitle")}
          body={t("emptyCourseBody")}
          cta={{ href: "/", label: t("explore") }}
        />
      </AppShell>
    );
  }

  const c = course.data;
  const blockReason = enrolmentBlock(c, batch.data);
  const block = blockReason ? (blockReason === "batch-full" ? t("batchFull") : t("noBatch")) : undefined;
  const language = courseLanguage(c);
  // Real runtimes and posters from the video records; lesson docs often
  // carry `videoDuration: 0` and no thumbnail of their own.
  const durations: Record<string, number> = {};
  const posters: Record<string, string> = {};
  for (const [lessonId, meta] of Object.entries(videoMeta.data ?? {})) {
    if (meta.durationSec) durations[lessonId] = meta.durationSec;
    if (meta.poster) posters[lessonId] = meta.poster;
  }
  const seconds =
    lessons.data?.reduce((sum, lesson) => sum + Number(lesson.videoDuration || durations[lesson.id] || 0), 0) || 0;
  const hours = Math.round(seconds / 3600);
  // One outline in the instructor's order: every chapter is a section holding
  // its lessons, its files and the tests that follow it.
  const outline = buildOutline({
    chapters: chapters.data ?? [],
    lessons: lessons.data ?? [],
    quizzes: quizzes.data ?? [],
    resources: resources.data ?? [],
    subscription: subscription.data ?? null,
    posters,
    durations,
    locale,
  });
  const counts = outlineCounts(outline);
  const enrolled = subscription.data?.status === "Ongoing";
  const staffViewer = Boolean(user) && !canPurchase(profile);
  const hasIntro = Boolean(c.videoRef || c.video);

  function openLesson(lesson: OutlineLesson) {
    if (enrolled && !lesson.locked) {
      router.push(`/course/${id}/learn?lesson=${lesson.id}`);
      return;
    }
    // Not unlocked: free previews play right here in a popup.
    if (lesson.preview) setPreview(lesson);
  }

  return (
    <AppShell compactHeader title={title} actions={actions}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:items-start lg:gap-6 lg:pt-1">
        <CourseCover
          image={courseThumb(c)}
          seed={id}
          batchName={batch.data?.name}
          aspect="16/9"
          video={
            hasIntro
              ? { src: playerSrc(intro), busy: introBusy, onPlay: () => void playIntro(), label: t("watchIntro") }
              : undefined
          }
        />
        <div>
          <CourseInfo
            sku={c.sku || id.slice(0, 8)}
            language={language}
            title={title}
            rating={Number(c.totalRatting || 0)}
            ratingLabel={t("rating")}
            enrolled={Number(c.bookedCount || 0)}
            enrolledLabel={t("studentsEnrolled")}
            description={c.description}
            seeMore={t("seeMore")}
            seeLess={t("seeLess")}
          />
          {enrolled ? (
            <EnrolledCta
              chapters={chapters.data?.length || 0}
              lessons={lessons.data?.length || 0}
              hours={hours}
              chaptersLabel={t("chapters")}
              lessonsLabel={t("lessons")}
              hoursLabel={t("hrs")}
              title={t("youAreEnrolled")}
              label={t("continueLearning")}
              onContinue={() => router.push(`/course/${id}/learn`)}
            />
          ) : staffViewer ? (
            <StaffViewOnlyNotice
              title={t("staffViewOnlyTitle")}
              body={t("staffViewOnlyBody")}
              price={formatKwdLocale(c.price, locale)}
            />
          ) : (
            <EnrollCta
              chapters={chapters.data?.length || 0}
              lessons={lessons.data?.length || 0}
              hours={hours}
              chaptersLabel={t("chapters")}
              lessonsLabel={t("lessons")}
              hoursLabel={t("hrs")}
              price={formatKwdLocale(c.price, locale)}
              enrollLabel={t("enrollNow")}
              emiPrice={t("emiMonths")
                .replace("{amount}", formatKwdLocale(emiPlan(c)[0], locale))
                .replace("{n}", String(courseEmiCount(c)))}
              emiLabel={t("payInEmi")}
              secure={t("secure")}
              block={block}
              busy={busy}
              showEmi={Boolean(c.emiPaymentStatus)}
              onEnroll={() => void addCart("Full payment")}
              onEmi={() => void addCart("EMI")}
            />
          )}
          {cartError ? <p className="mt-2 text-center text-[12px] text-[#f24822]">{cartError}</p> : null}
        </div>
      </div>

      {instructor.data ? (
        <InstructorCard
          href={`/instructor/${instructor.data.id}`}
          name={instructor.data.display_name || t("instructor")}
          photo={avatarSrc(instructor.data, instructor.data.id)}
          bio={instructor.data.bio}
          rating={Number(c.totalRatting || 0)}
          ratingLabel={t("rating")}
          verified={instructor.data.instuctorStatus === "Approved"}
        />
      ) : null}

      <div className="mt-5 flex items-center gap-2 border-b border-white/10 pb-2">
        <span className="text-[15px] font-semibold text-[#fafafa]">{t("lessonsAndChapters")}</span>
        <span className="rounded-[8px] bg-[#141414] px-1.5 py-0.5 text-[10px] text-[#999]">
          {counts.lessons} {t("lessons")}
          {counts.files ? ` · ${counts.files} ${t("attachments").toLowerCase()}` : ""}
          {counts.tests ? ` · ${counts.tests} ${t("tests").toLowerCase()}` : ""}
        </span>
      </div>
      <ChapterSections
        items={outline}
        locale={locale}
        quizResults={quizResults.data}
        onLesson={openLesson}
        onFile={(file) => (isPreviewable(file) ? setPreviewFile(file) : downloadFile(file))}
        onQuiz={enrolled ? (quizId) => router.push(`/course/${id}/learn?quiz=${quizId}`) : undefined}
        onBuyChapter={
          c.coursePaymentType === "Free" || staffViewer || enrolled
            ? undefined
            : (chapterId) => void addChapterToCart(chapterId)
        }
      />
      {preview ? <VideoPopup lessonId={preview.id} title={preview.name} onClose={() => setPreview(null)} /> : null}
      {previewFile ? <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
    </AppShell>
  );
}

/** The course's installment plan; even split of the price when none is stored. */
function emiPlan(course: {
  price?: number;
  emiCount?: number;
  emiAmounts?: number[];
  firstEMIprice?: number;
  secondEMIprice?: number;
  thirdEMIprice?: number;
}) {
  const count = courseEmiCount(course);
  const stored = courseEmiAmounts(course).slice(0, count);
  if (stored.length === count && stored.every((a) => a > 0)) return stored;
  return splitEmi(Number(course.price) || 0, "even", count);
}

function courseLanguage(course: object) {
  const value = (course as { language?: unknown }).language;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
