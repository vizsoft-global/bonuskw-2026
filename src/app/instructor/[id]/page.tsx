"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { ExploreGridCard, exploreGridClass, type ExploreItem } from "@/components/home/explore-card";
import { HomeIcon } from "@/components/home/icon";
import { InstructorHero, InstructorTabs } from "@/components/instructor/hero";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { InstructorSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { purchaseKindFor, usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getBatch, listCourses, publishedCourses } from "@/lib/catalog/queries";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { ebookPageCount, isEbookCourse } from "@/lib/format";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc, UserDoc } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatar";
import { courseThumb } from "@/lib/course/thumb";

export default function InstructorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const gate = usePurchaseGate();
  const [tab, setTab] = useState<"courses" | "ebooks">("courses");

  const instructor = useQuery({
    queryKey: ["instructor", id],
    queryFn: async () => {
      const snap = await getDoc(doc(getDb(), collections.users, id));
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as UserDoc) }) : null;
    },
  });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });

  const mine = publishedCourses(courses.data ?? []).filter((c) => c.authorRef?.id === id);
  const courseRows = mine.filter((c) => !isEbookCourse(c));
  const ebookRows = mine.filter((c) => isEbookCourse(c));
  const visible = tab === "ebooks" ? ebookRows : courseRows;

  const batchIds = [...new Set(courseRows.map((c) => c.batchesRef?.id).filter(Boolean))] as string[];
  const batches = useQuery({
    queryKey: ["instructor-batches", batchIds.join(",")],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        batchIds.map(async (batchId) => {
          const row = await getBatch(batchId);
          return [batchId, row?.name || ""] as const;
        }),
      );
      return Object.fromEntries(pairs) as Record<string, string>;
    },
  });

  const savedKey = (profile?.fvrtCourseList ?? []).map((ref) => ref.id).join(",");
  const savedIds = useMemo(() => new Set(savedKey ? savedKey.split(",") : []), [savedKey]);

  const name = instructor.data?.display_name || t("instructor");
  const ratings = mine.map((c) => Number(c.totalRatting || 0)).filter((n) => n > 0);
  const rating = ratings.length ? ratings.reduce((sum, n) => sum + n, 0) / ratings.length : 0;

  const items: ExploreItem[] = visible.map((row) => {
    const ebook = isEbookCourse(row);
    const pages = ebookPageCount(row);
    return {
      id: row.id,
      name: localizedField(row.name, row.nameManualTranslate, row.nameAutoTranslate, locale),
      image: courseThumb(row),
      rating: Number(row.totalRatting || 0),
      author: name,
      authorPhoto: instructor.data ? avatarSrc(instructor.data, id) : undefined,
      lessons: ebook ? undefined : Number(row.numberLessons || 0),
      hours: ebook ? undefined : Number(row.totalHours || row.totalCourseHour || 0),
      pages: ebook ? pages : undefined,
      batch: !ebook && row.batchesRef?.id ? batches.data?.[row.batchesRef.id] : undefined,
      saved: savedIds.has(row.id),
      href: ebook ? `/store/${row.id}` : `/course/${row.id}`,
      aspect: ebook ? "3/4" : "5/3",
    };
  });

  async function addItem(row: CourseDoc & { id: string }) {
    if (!user) {
      router.push("/login");
      return;
    }
    if (gate.blockFor(purchaseKindFor(row))) return;
    if (isEbookCourse(row)) await addEbookToCart(user.uid, row);
    else await addCourseToCart(user.uid, row);
    router.push("/cart");
  }

  async function toggleSave(courseId: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    const saved = savedIds.has(courseId);
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      fvrtCourseList: saved
        ? arrayRemove(doc(getDb(), collections.course, courseId))
        : arrayUnion(doc(getDb(), collections.course, courseId)),
    });
    await refreshProfile();
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled */
    }
  }

  const courseLabels = {
    enroll: t("enroll"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
  };
  const ebookLabels = {
    enroll: t("addToCart"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
    pages: t("pages"),
  };

  const actions = (
    <button type="button" onClick={() => void share()} aria-label={t("share")} className="grid size-6 place-items-center">
      <span className="size-5">
        <HomeIcon src="/course/share.svg" />
      </span>
    </button>
  );

  if (instructor.isPending || courses.isPending) {
    return (
      <AppShell loading compactHeader title={t("instructorDetails")} actions={actions} skeleton={<InstructorSkeleton />} />
    );
  }
  if (!instructor.data) {
    return (
      <AppShell compactHeader title={t("instructorDetails")} actions={actions}>
        <EmptyState
          icon="/course/book.svg"
          title={t("instructor")}
          body={t("emptyInstructorCoursesBody")}
          cta={{ href: "/", label: t("explore") }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell compactHeader title={t("instructorDetails")} actions={actions}>
      <InstructorHero
        photo={avatarSrc(instructor.data, id)}
        name={name}
        bio={instructor.data.bio}
        verified={instructor.data.instuctorStatus === "Approved"}
        rating={rating}
        courseCount={courseRows.length}
        ebookCount={ebookRows.length}
        labels={{
          rating: t("rating"),
          totalCourses: t("totalCourses"),
          ebooks: t("ebooks"),
          coursesUnit: t("coursesUnit"),
          booksUnit: t("booksUnit"),
        }}
      />

      <InstructorTabs
        tab={tab}
        onTab={setTab}
        courses={courseRows.length}
        ebooks={ebookRows.length}
        labels={{ courses: t("coursesUnit"), ebooks: t("ebooks") }}
      />

      {items.length ? (
        <div
          className={cn(
            "mt-5",
            exploreGridClass,
            tab === "ebooks"
              ? "lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
              : "lg:grid-cols-[repeat(auto-fill,minmax(227px,1fr))]",
          )}
        >
          {items.map((item) => {
            const row = visible.find((c) => c.id === item.id);
            return (
              <ExploreGridCard
                key={item.id}
                item={item}
                labels={tab === "ebooks" ? ebookLabels : courseLabels}
                onEnroll={() => row && void addItem(row)}
                onSave={() => void toggleSave(item.id)}
                enrollBlocked={row ? gate.blockFor(purchaseKindFor(row)) : undefined}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="/course/book.svg"
          title={tab === "ebooks" ? t("emptyInstructorEbooksTitle") : t("emptyInstructorCoursesTitle")}
          body={tab === "ebooks" ? t("emptyInstructorEbooksBody") : t("emptyInstructorCoursesBody")}
        />
      )}
    </AppShell>
  );
}

async function addCourseToCart(uid: string, course: CourseDoc & { id: string }) {
  const cart = await loadCart(uid);
  await saveCart(
    uid,
    upsertLine(cart, {
      kind: "course",
      courseId: course.id,
      paymentType: "Full payment",
      title: course.name,
      image: courseThumb(course),
      price: course.price,
      addedAt: Date.now(),
    }),
  );
}

async function addEbookToCart(uid: string, book: CourseDoc & { id: string }) {
  const cart = await loadCart(uid);
  await saveCart(
    uid,
    upsertLine(cart, {
      kind: "ebook",
      courseId: book.id,
      paymentType: "Full payment",
      title: book.name,
      image: book.image,
      price: book.price,
      addedAt: Date.now(),
    }),
  );
}
