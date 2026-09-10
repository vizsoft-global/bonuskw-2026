"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ContinueCard, type ContinueItem } from "@/components/home/continue-card";
import { ExploreGridCard, exploreRailClass, type ExploreItem } from "@/components/home/explore-card";
import { StatsCard } from "@/components/home/stats-card";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StoreSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { getCourse, listLessons } from "@/lib/catalog/queries";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { ebookPageCount } from "@/lib/format";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc } from "@/lib/types/firestore";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn();
  }
  return null;
}

async function loadContinueItems(uid: string, courseIds: Array<string | undefined>): Promise<ContinueItem[]> {
  const ids = courseIds.filter((id): id is string => Boolean(id)).slice(0, 8);
  if (!ids.length) return [];
  const db = getDb();
  const userRef = doc(db, collections.users, uid);
  const progressSnap = await getDocs(
    query(collection(db, collections.watchProgress), where("userRef", "==", userRef)),
  );
  const progress = progressSnap.docs.map((d) => ({
    courseId: d.get("courseRef")?.id as string | undefined,
    lessonId: String(d.get("lessonId") || ""),
    completed: Boolean(d.get("completed")),
    updatedAt: toDate(d.get("updatedAt")),
  }));

  const rows: Array<ContinueItem | null> = await Promise.all(
    ids.map(async (courseId) => {
      const [course, lessons] = await Promise.all([getCourse(courseId), listLessons(courseId)]);
      if (!course) return null;
      const courseProgress = progress.filter((p) => p.courseId === courseId);
      const completedIds = new Set(courseProgress.filter((p) => p.completed).map((p) => p.lessonId));
      const total = lessons.length || 1;
      const done = lessons.filter((l) => completedIds.has(l.id)).length;
      const remaining = lessons.filter((l) => !completedIds.has(l.id));
      const hrsLeft = Math.round(remaining.reduce((sum, l) => sum + Number(l.videoDuration || 0), 0) / 3600);
      const last = courseProgress.reduce<Date | null>((max, p) => {
        if (!p.updatedAt) return max;
        return !max || p.updatedAt > max ? p.updatedAt : max;
      }, null);
      return {
        courseId,
        name: course.name || "",
        image: course.image,
        pct: Math.round((done / total) * 100),
        hrsLeft,
        nextName: remaining[0] ? String(remaining[0].name || "") : undefined,
        lastStudied: last ? formatDistanceToNow(last, { addSuffix: true }) : undefined,
      };
    }),
  );
  return rows.filter((row): row is ContinueItem => row !== null);
}

export default function MySpacePage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const uid = user?.uid;

  const stats = useQuery({
    queryKey: ["stats", uid],
    enabled: Boolean(uid),
    queryFn: async () =>
      ((await getDoc(doc(getDb(), collections.userStats, uid!))).data() as
        | { streakDays?: number; studySeconds?: number }
        | undefined) ?? null,
  });
  const courses = useQuery({
    queryKey: ["my-subs", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.subscription), where("userRef", "==", doc(getDb(), collections.users, uid!))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });
  const books = useQuery({
    queryKey: ["my-books", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.ebookAccess), where("userRef", "==", doc(getDb(), collections.users, uid!))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });
  const continueLearning = useQuery({
    queryKey: ["continue", uid, (courses.data ?? []).map((d) => d.id).join(",")],
    enabled: Boolean(uid && courses.data),
    queryFn: () => loadContinueItems(uid!, (courses.data ?? []).map((d) => d.get("courseRef")?.id as string | undefined)),
  });
  const bookIds = (books.data ?? []).map((d) => d.get("courseRef")?.id as string | undefined).filter(Boolean) as string[];
  const ebookDocs = useQuery({
    queryKey: ["my-ebook-docs", bookIds.join(",")],
    enabled: bookIds.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(bookIds.map((id) => getCourse(id)));
      return rows.filter((row): row is CourseDoc & { id: string } => Boolean(row));
    },
  });

  const hours = Math.round((stats.data?.studySeconds || 0) / 3600);
  const ebookItems: ExploreItem[] = useMemo(
    () =>
      (ebookDocs.data ?? []).map((book) => {
        const pages = ebookPageCount(book);
        return {
          id: book.id,
          name: localizedField(book.name, book.nameManualTranslate, book.nameAutoTranslate, locale),
          image: book.image,
          rating: Number(book.totalRatting || 0),
          pages: pages > 0 ? pages : undefined,
          href: `/store/${book.id}`,
          aspect: "3/4" as const,
        };
      }),
    [ebookDocs.data, locale],
  );

  const statsLabels = {
    myStats: t("myStats"),
    streak: t("streak"),
    activeCourses: t("activeCourses"),
    studyTime: t("studyTime"),
    daysUnit: t("daysUnit"),
    coursesUnit: t("coursesUnit"),
    hoursUnit: t("hoursUnit"),
  };
  const continueLabels = {
    percentCompleted: t("percentCompleted"),
    hrsLeft: t("hrsLeft"),
    nextLesson: t("nextLesson"),
    lastStudied: t("lastStudied"),
    resume: t("resume"),
  };
  const cardLabels = {
    enroll: t("purchased"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
    pages: t("pages"),
  };

  return (
    <AppShell loading={stats.isPending || courses.isPending || books.isPending} skeleton={<StoreSkeleton />}>
      <div className="flex flex-col">
        <h1 className="hidden text-[20px] font-semibold text-[#fafafa] lg:block lg:pt-[30px]">{t("mySpace")}</h1>

        <div className="pt-5 lg:pt-4">
          <StatsCard
            streak={stats.data?.streakDays || 0}
            courses={courses.data?.length || 0}
            hours={hours}
            labels={statsLabels}
          />
        </div>

        {(continueLearning.data ?? []).length ? (
          <section className="flex flex-col gap-5 py-5">
            <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("continueLearning")}</h2>
            <div className={exploreRailClass}>
              {(continueLearning.data ?? []).map((item) => (
                <ContinueCard key={item.courseId} item={item} labels={continueLabels} />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-5">
            <h2 className="mb-3 text-[14px] font-semibold text-[#fafafa]">{t("continueLearning")}</h2>
            <EmptyState
              icon="/course/book.svg"
              title={t("emptyMyCoursesTitle")}
              body={t("emptyMyCoursesBody")}
              cta={{ href: "/", label: t("explore") }}
            />
          </section>
        )}

        <section className="flex flex-col gap-5 py-5">
          <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("myEbooks")}</h2>
          {ebookItems.length ? (
            <div className={exploreRailClass}>
              {ebookItems.map((item) => (
                <div key={item.id} className="w-[180px] shrink-0 lg:w-[227px]">
                  <ExploreGridCard
                    item={item}
                    labels={cardLabels}
                    onEnroll={() => router.push(`/store/${item.id}`)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="/profile/book.svg"
              title={t("emptyMyEbooksTitle")}
              body={t("emptyMyEbooksBody")}
              cta={{ href: "/store", label: t("store") }}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
