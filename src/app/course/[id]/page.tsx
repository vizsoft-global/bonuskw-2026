"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { LockBadge, PrimaryButton, RatingStars } from "@/components/shared/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getBatch, getCourse, listChapters, listLessons, listQuizzes } from "@/lib/catalog/queries";
import { enrolmentBlock } from "@/lib/course/enrol";
import { lessonAccess } from "@/lib/course/entitlement";
import { isLessonLocked } from "@/lib/course/locks";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatDuration, isEbookCourse } from "@/lib/format";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { LessonDoc } from "@/lib/types/firestore";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<"lessons" | "resources" | "tests">("lessons");
  const [grid, setGrid] = useState(false);
  const course = useQuery({ queryKey: ["course", id], queryFn: () => getCourse(id) });
  const batch = useQuery({
    queryKey: ["batch", course.data?.batchesRef?.id],
    queryFn: () => getBatch(course.data?.batchesRef?.id),
    enabled: Boolean(course.data?.batchesRef?.id),
  });
  const chapters = useQuery({ queryKey: ["chapters", id], queryFn: () => listChapters(id) });
  const lessons = useQuery({ queryKey: ["lessons", id], queryFn: () => listLessons(id) });
  const quizzes = useQuery({ queryKey: ["quizzes", id], queryFn: () => listQuizzes(id) });

  if (!course.data) {
    return (
      <AppShell>
        <p className="text-muted">{t("empty")}</p>
      </AppShell>
    );
  }

  const c = course.data;
  const block = isEbookCourse(c) ? "ebook" : enrolmentBlock(c, batch.data);
  const hours = lessons.data?.reduce((sum, lesson) => sum + Number(lesson.videoDuration || 0), 0) || 0;
  const saved = Boolean(profile?.fvrtCourseList?.some((ref) => ref.id === id));

  async function toggleSave() {
    if (!user) return;
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      fvrtCourseList: saved
        ? arrayRemove(doc(getDb(), collections.course, id))
        : arrayUnion(doc(getDb(), collections.course, id)),
    });
  }

  async function addCart(paymentType: "Full payment" | "EMI") {
    if (!user) return;
    if (c.coursePaymentType === "Free") {
      const token = await user.getIdToken();
      await fetch("/api/enrol/free", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: id }),
      });
      window.location.href = `/course/${id}/learn`;
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
        price: coursePrice(c, paymentType),
        addedAt: Date.now(),
      }),
    );
    window.location.href = "/cart";
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: c.name, url });
    else await navigator.clipboard.writeText(url);
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {localizedField(c.name, c.nameManualTranslate, c.nameAutoTranslate, locale)}
        </h1>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => void share()}>{t("share")}</button>
          <button type="button" onClick={() => void toggleSave()}>{saved ? t("saved") : t("bookmark")}</button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-black/30">
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-gradient-to-br from-[#111] to-accent/40">Bonus</div>
            )}
            {batch.data?.status === "Ongoing" ? (
              <span className="absolute bottom-3 end-3 rounded-full bg-black/60 px-2 py-1 text-xs">{batch.data.name}</span>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-muted">{c.description}</p>
          {c.authorRef ? (
            <Link href={`/instructor/${c.authorRef.id}`} className="mt-4 flex items-center justify-between rounded-2xl border border-line p-3">
              <span>{t("instructor")}</span>
              <RatingStars value={c.totalRatting} />
            </Link>
          ) : null}
        </div>
        <aside className="glass h-fit rounded-3xl p-4 lg:sticky lg:top-24">
          <div className="mb-3 flex justify-between text-sm text-muted">
            <span>{chapters.data?.length || 0} {t("chapters")}</span>
            <span>{lessons.data?.length || 0} {t("lessons")}</span>
            <span>{formatDuration(hours)}</span>
          </div>
          <p className="text-2xl font-semibold">{formatKwdLocale(c.price, locale)}</p>
          {c.emiPaymentStatus ? (
            <p className="mt-1 text-xs text-muted">
              {formatKwdLocale(c.firstEMIprice, locale)} / {formatKwdLocale(c.secondEMIprice, locale)} / {formatKwdLocale(c.thirdEMIprice, locale)}
            </p>
          ) : null}
          {block ? (
            <p className="mt-3 text-sm text-accent">{block === "batch-full" ? t("batchFull") : t("noBatch")}</p>
          ) : (
            <div className="mt-4 grid gap-2">
              <PrimaryButton onClick={() => void addCart("Full payment")}>{t("enrollNow")}</PrimaryButton>
              {c.emiPaymentStatus ? (
                <button type="button" className="rounded-full border border-line py-2 text-sm" onClick={() => void addCart("EMI")}>
                  {t("emi")}
                </button>
              ) : null}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">{t("secure")}</p>
        </aside>
      </div>
      <div className="mt-8 flex gap-4 border-b border-line text-sm">
        {(["lessons", "resources", "tests"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "border-b-2 border-primary pb-2" : "pb-2 text-muted"} onClick={() => setTab(item)}>
            {t(item === "lessons" ? "lessons" : item === "resources" ? "resources" : "tests")}
          </button>
        ))}
        <button type="button" className="ms-auto text-muted" onClick={() => setGrid((v) => !v)}>
          {grid ? "List" : "Grid"}
        </button>
      </div>
      {tab === "lessons" ? (
        <div className={grid ? "mt-4 grid gap-3 sm:grid-cols-2" : "mt-4 divide-y divide-line"}>
          {(chapters.data ?? []).map((chapter) => (
            <section key={chapter.id} className="py-3">
              <h3 className="mb-2 font-medium">{String(chapter.name || "Chapter")}</h3>
              {(lessons.data ?? [])
                .filter((lesson) => (lesson.chapterRef as { id?: string } | undefined)?.id === chapter.id)
                .map((lesson) => {
                  const access = lessonAccess({ lesson: lesson as LessonDoc, chapter: chapter as never });
                  return (
                    <div key={lesson.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{String(lesson.name || "Lesson")} · {formatDuration(Number(lesson.videoDuration || 0))}</span>
                      <LockBadge locked={access === "locked" || isLessonLocked(lesson as LessonDoc)} />
                    </div>
                  );
                })}
              {chapter.sellable ? (
                <p className="text-xs text-primary">Buy chapter · {formatKwdLocale(Number(chapter.price), locale)}</p>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
      {tab === "resources" ? (
        <ul className="mt-4 space-y-2 text-sm">
          {(lessons.data ?? []).flatMap((lesson) =>
            (lesson.lesson_file_list as Array<{ lesson_file_link?: string }> | undefined)?.map((file, i) => (
              <li key={`${lesson.id}-${i}`} className="flex items-center justify-between">
                <span>{file.lesson_file_link || "File"}</span>
                <LockBadge locked />
              </li>
            )) ?? [],
          )}
        </ul>
      ) : null}
      {tab === "tests" ? (
        <ul className="mt-4 space-y-2 text-sm">
          {(quizzes.data ?? []).map((quiz) => (
            <li key={quiz.id} className="flex items-center justify-between">
              <span>{String(quiz.name || "Test")}</span>
              <LockBadge locked={quiz.status === false} />
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}

function coursePrice(course: { price?: number; firstEMIprice?: number }, paymentType: string) {
  return paymentType === "EMI" ? course.firstEMIprice : course.price;
}
