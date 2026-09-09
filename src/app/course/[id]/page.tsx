"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { CourseHeaderActions } from "@/components/course/header-actions";
import { CourseCover, CourseInfo } from "@/components/course/hero";
import { EnrollCta } from "@/components/course/enroll-cta";
import { InstructorCard } from "@/components/course/instructor-card";
import { LessonAccordion } from "@/components/course/lesson-accordion";
import { fileNameFromUrl, fileTypeFromUrl, ResourceRow } from "@/components/course/resource-row";
import { CourseTabs, type CourseTab } from "@/components/course/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseDetailsSkeleton } from "@/components/shared/skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { HomeIcon } from "@/components/home/icon";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getBatch, getCourse, listChapters, listLessons, listQuizzes } from "@/lib/catalog/queries";
import { enrolmentBlock } from "@/lib/course/enrol";
import { courseEmiAmounts, courseEmiCount, splitEmi } from "@/lib/course/emi";
import { lessonAccess } from "@/lib/course/entitlement";
import { isLessonLocked, isQuizLocked } from "@/lib/course/locks";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { LessonDoc, LessonFile, UserDoc } from "@/lib/types/firestore";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile, ready } = useAuth();
  const [tab, setTab] = useState<CourseTab>("lessons");
  const [busy, setBusy] = useState(false);
  const [cartError, setCartError] = useState("");
  const course = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const batch = useQuery({
    queryKey: ["batch", course.data?.batchesRef?.id],
    queryFn: () => getBatch(course.data?.batchesRef?.id),
    enabled: Boolean(course.data?.batchesRef?.id),
  });
  const chapters = useQuery({ queryKey: ["chapters", id], queryFn: () => listChapters(id) });
  const lessons = useQuery({ queryKey: ["lessons", id], queryFn: () => listLessons(id) });
  const quizzes = useQuery({
    queryKey: ["quizzes", id],
    queryFn: () => listQuizzes(id),
    enabled: tab === "tests",
  });
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
          image: c.image,
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
  const seconds = lessons.data?.reduce((sum, lesson) => sum + Number(lesson.videoDuration || 0), 0) || 0;
  const hours = Math.round(seconds / 3600);
  const language = courseLanguage(c);
  const resources = (lessons.data ?? []).flatMap((lesson) =>
    ((lesson.lesson_file_list as LessonFile[] | undefined) ?? []).map((file, i) => {
      const url = file.lesson_file_link || "";
      return {
        key: `${lesson.id}-${i}`,
        name: url ? fileNameFromUrl(url) : "File",
        type: url ? fileTypeFromUrl(url) : "FILE",
      };
    }),
  );
  const lessonRows = lessons.data ?? [];
  const lessonsByChapter = new Map<string, typeof lessonRows>();
  for (const lesson of lessonRows) {
    const chapterId = (lesson.chapterRef as { id?: string } | undefined)?.id;
    if (!chapterId) continue;
    const bucket = lessonsByChapter.get(chapterId);
    if (bucket) bucket.push(lesson);
    else lessonsByChapter.set(chapterId, [lesson]);
  }
  const chapterRows = (chapters.data ?? []).map((chapter) => ({
    id: chapter.id,
    name: chapter.name,
    sellable: chapter.sellable,
    price: chapter.price,
    lessons: (lessonsByChapter.get(chapter.id) ?? []).map((lesson) => ({
      id: lesson.id,
      name: lesson.name,
      image: lesson.image,
      videoDuration: lesson.videoDuration,
      locked:
        lessonAccess({ lesson: lesson as LessonDoc, chapter: chapter as never }) === "locked" ||
        isLessonLocked(lesson as LessonDoc),
    })),
  }));

  return (
    <AppShell compactHeader title={title} actions={actions}>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-8 lg:pt-2">
        <CourseCover image={c.image} batchName={batch.data?.name} />
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
            onEnroll={() => void addCart("Full payment")}
            onEmi={() => void addCart("EMI")}
          />
          {cartError ? <p className="mt-2 text-center text-[12px] text-[#f24822]">{cartError}</p> : null}
        </div>
      </div>

      {instructor.data ? (
        <InstructorCard
          href={`/instructor/${instructor.data.id}`}
          name={instructor.data.display_name || t("instructor")}
          bio={instructor.data.bio}
          rating={Number(c.totalRatting || 0)}
          ratingLabel={t("rating")}
          verified={instructor.data.instuctorStatus === "Approved"}
        />
      ) : null}

      <CourseTabs
        tab={tab}
        onTab={setTab}
        counts={{
          lessons: lessons.data?.length || 0,
          resources: resources.length,
          tests: quizzes.data?.length || 0,
        }}
        labels={{
          lessons: t("chaptersLessons"),
          resources: t("resources"),
          tests: t("tests"),
        }}
      />

      {tab === "lessons" ? <LessonAccordion chapters={chapterRows} locale={locale} /> : null}
      {tab === "resources" ? (
        <div className="divide-y divide-white/10">
          {resources.map((file) => (
            <ResourceRow key={file.key} name={file.name} type={file.type} />
          ))}
        </div>
      ) : null}
      {tab === "tests" ? (
        <div className="divide-y divide-white/10">
          {(quizzes.data ?? []).map((quiz) => (
            <div key={quiz.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#fafafa]">
                {String(quiz.name || t("tests"))}
              </span>
              {isQuizLocked(quiz as never) ? (
                <span className="size-4 shrink-0">
                  <HomeIcon src="/course/lock.svg" />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
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
