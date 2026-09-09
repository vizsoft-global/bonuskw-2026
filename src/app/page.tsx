"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Splash } from "@/components/auth/splash";
import { ContinueCard, type ContinueItem } from "@/components/home/continue-card";
import {
  ExploreGridCard,
  ExploreListCard,
  exploreGridClass,
  exploreRailClass,
  type ExploreItem,
} from "@/components/home/explore-card";
import { HomeIcon } from "@/components/home/icon";
import { StatsCard } from "@/components/home/stats-card";
import { StoriesRow } from "@/components/home/stories-row";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { HomeSkeleton } from "@/components/shared/skeleton";
import { PageLoader } from "@/components/shared/loader";
import { useAuth } from "@/lib/auth/auth-provider";
import { CATALOG_STALE_MS, exploreCourses, getCourse, getDocsByIds, listCourses } from "@/lib/catalog/queries";
import { upsertLine, loadCart, saveCart } from "@/lib/cart/store";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc, SettingsDoc } from "@/lib/types/firestore";
import { isStoryActive } from "@/lib/stories/media";
import { cn } from "@/lib/utils";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn();
  }
  return null;
}

const SPLASH_KEY = "ba_splash_done";
let splashPlayed = false;

export default function HomePage() {
  const { user, profile, ready, needsOnboarding, kicked } = useAuth();
  const router = useRouter();
  const [boot, setBoot] = useState<"wait" | "splash" | "go">(splashPlayed ? "go" : "wait");

  useEffect(() => {
    if (splashPlayed) {
      setBoot("go");
      return;
    }
    try {
      if (sessionStorage.getItem(SPLASH_KEY) === "1") {
        splashPlayed = true;
        setBoot("go");
        return;
      }
    } catch {
      /* private mode */
    }
    setBoot("splash");
    const id = window.setTimeout(() => {
      splashPlayed = true;
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* private mode */
      }
      setBoot("go");
    }, 900);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (boot !== "go" || !ready) return;
    if (kicked) router.replace("/session-ended");
    else if (!user) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [boot, ready, kicked, user, needsOnboarding, router]);

  if (boot === "splash") return <Splash />;
  if (boot !== "go" || !ready || kicked || !user || needsOnboarding) {
    return <PageLoader full />;
  }

  return <HomeBody uid={user.uid} branchId={profile?.branchRef?.id} />;
}

function HomeBody({ uid, branchId }: { uid: string; branchId?: string }) {
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses, staleTime: CATALOG_STALE_MS });
  const stories = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const snap = await getDocs(collection(getDb(), collections.settings));
      const main = snap.docs.find((d) => d.get("type") === "Main")?.data() as SettingsDoc | undefined;
      return (main?.settings_status ?? []).filter(isStoryActive);
    },
  });
  const stats = useQuery({
    queryKey: ["stats", uid],
    queryFn: async () => {
      const snap = await getDoc(doc(getDb(), collections.userStats, uid));
      return snap.data() as { streakDays?: number; studySeconds?: number } | undefined;
    },
  });
  const subs = useQuery({
    queryKey: ["subs", uid],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.subscription), where("userRef", "==", doc(getDb(), collections.users, uid))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });
  const categories = useQuery({
    queryKey: ["courseCategory"],
    queryFn: async () => {
      const snap = await getDocs(collection(getDb(), collections.courseCategory));
      return snap.docs
        .map((d) => ({
          id: d.id,
          name: String(d.get("name") || d.id),
          status: String(d.get("status") || ""),
        }))
        .filter((c) => !c.status || /active|publish/i.test(c.status));
    },
  });
  const continueLearning = useQuery({
    queryKey: ["continue", uid, (subs.data ?? []).map((d) => d.id).join(",")],
    enabled: Boolean(subs.data),
    queryFn: () => loadContinueItems(uid, (subs.data ?? []).map((d) => d.get("courseRef")?.id as string | undefined)),
  });

  const published = exploreCourses(courses.data ?? [], branchId ? ({ branchRef: { id: branchId } } as never) : null);
  const explore = topic ? published.filter((c) => c.courseCategoryRef?.id === topic) : published;

  const authorIds = [...new Set(explore.map((c) => c.authorRef?.id).filter(Boolean))] as string[];
  const batchIds = [...new Set(explore.map((c) => c.batchesRef?.id).filter(Boolean))] as string[];

  const authors = useQuery({
    queryKey: ["authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    staleTime: CATALOG_STALE_MS,
    queryFn: async () => {
      const rows = await getDocsByIds(collections.users, authorIds);
      return Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, String(row.display_name || "")]));
    },
  });
  const batches = useQuery({
    queryKey: ["home-batches", batchIds.join(",")],
    enabled: batchIds.length > 0,
    staleTime: CATALOG_STALE_MS,
    queryFn: async () => {
      const rows = await getDocsByIds(collections.batches, batchIds);
      return Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, String(row.name || "")]));
    },
  });

  const hours = Math.round((stats.data?.studySeconds || 0) / 3600);
  const savedKey = (profile?.fvrtCourseList ?? []).map((ref) => ref.id).join(",");
  const savedIds = useMemo(() => new Set(savedKey ? savedKey.split(",") : []), [savedKey]);

  const exploreItems: ExploreItem[] = useMemo(
    () =>
      explore.map((course) => ({
        id: course.id,
        name: localizedField(course.name, course.nameManualTranslate, course.nameAutoTranslate, locale),
        image: course.image,
        rating: Number(course.totalRatting || 0),
        author: course.authorRef?.id ? authors.data?.[course.authorRef.id] : undefined,
        lessons: Number(course.numberLessons || 0),
        hours: Number(course.totalHours || course.totalCourseHour || 0),
        batch: course.batchesRef?.id ? batches.data?.[course.batchesRef.id] : undefined,
        saved: savedIds.has(course.id),
      })),
    [explore, authors.data, batches.data, locale, savedIds],
  );

  async function enrol(course: CourseDoc & { id: string }) {
    await addCourseToCart(uid, course);
    router.push("/cart");
  }

  async function toggleSave(courseId: string) {
    if (!user) return;
    const saved = savedIds.has(courseId);
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      fvrtCourseList: saved
        ? arrayRemove(doc(getDb(), collections.course, courseId))
        : arrayUnion(doc(getDb(), collections.course, courseId)),
    });
    await refreshProfile();
  }

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
  const exploreLabels = {
    enroll: t("enroll"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
  };
  const storyItems = stories.data ?? [];

  return (
    <AppShell headerExtra={<StoriesRow stories={storyItems} />} loading={courses.isPending} skeleton={<HomeSkeleton />}>
      <div className="flex flex-col">
        <p className="hidden text-[20px] font-semibold text-[#fafafa] lg:block lg:pt-[30px]">
          {t("hello")} {profile?.display_name || t("profile")}
        </p>

        <div className="flex flex-col gap-5 pt-5 lg:flex-row lg:items-center lg:gap-[30px] lg:pt-4">
          <StatsCard
            streak={stats.data?.streakDays || 0}
            courses={subs.data?.length || 0}
            hours={hours}
            labels={statsLabels}
          />
          <div className="hidden min-w-0 flex-1 lg:block">
            <StoriesRow stories={storyItems} fade />
          </div>
        </div>

        {(continueLearning.data ?? []).length ? (
          <section className="flex flex-col gap-5 px-0 py-5">
            <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("continueLearning")}</h2>
            <div className={exploreRailClass}>
              {(continueLearning.data ?? []).map((item) => (
                <ContinueCard key={item.courseId} item={item} labels={continueLabels} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-[25px] py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("explore")}</h2>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label={t("gridView")}
                className={cn("size-4", view === "list" && "opacity-40")}
              >
                <HomeIcon src="/home/grid-view.svg" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label={t("listView")}
                className={cn("size-4", view === "grid" && "opacity-40")}
              >
                <HomeIcon src="/home/list-view.svg" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            <button
              type="button"
              onClick={() => setTopic("")}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-[27px] px-3 py-2 text-[14px]",
                !topic ? "bg-[#f2f2f2] font-medium text-[#141414]" : "bg-[#141414] text-[#fafafa]",
              )}
            >
              <span className="size-4">
                <HomeIcon src="/home/shapes.svg" />
              </span>
              {t("all")}
            </button>
            {(categories.data ?? []).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTopic(cat.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-[27px] px-3 py-2 text-[14px]",
                  topic === cat.id ? "bg-[#f2f2f2] font-medium text-[#141414]" : "bg-[#141414] text-[#fafafa]",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {exploreItems.length ? (
            view === "list" ? (
              <div className="flex flex-col gap-3">
                {exploreItems.map((item) => {
                  const course = explore.find((c) => c.id === item.id);
                  return (
                    <ExploreListCard
                      key={item.id}
                      item={item}
                      labels={exploreLabels}
                      onEnroll={() => course && void enrol(course)}
                      onSave={() => void toggleSave(item.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className={cn(exploreGridClass, "lg:grid-cols-[repeat(auto-fill,minmax(227px,1fr))]")}>
                {exploreItems.map((item) => {
                  const course = explore.find((c) => c.id === item.id);
                  return (
                    <ExploreGridCard
                      key={item.id}
                      item={item}
                      labels={exploreLabels}
                      onEnroll={() => course && void enrol(course)}
                      onSave={() => void toggleSave(item.id)}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <EmptyState
              icon="/home/shapes.svg"
              title={topic ? t("emptyExploreTopicTitle") : t("emptyExploreTitle")}
              body={topic ? t("emptyExploreTopicBody") : t("emptyExploreBody")}
              cta={topic ? { onClick: () => setTopic(""), label: t("viewAll") } : undefined}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
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

  const courses = await Promise.all(ids.map((courseId) => getCourse(courseId)));
  return courses.flatMap((course, index) => {
    if (!course) return [];
    const courseId = ids[index];
    const courseProgress = progress.filter((p) => p.courseId === courseId);
    const done = courseProgress.filter((p) => p.completed).length;
    const total = Math.max(Number(course.numberLessons || 0), done, 1);
    const hours = Number(course.totalHours || course.totalCourseHour || 0);
    const last = courseProgress.reduce<Date | null>((max, p) => {
      if (!p.updatedAt) return max;
      return !max || p.updatedAt > max ? p.updatedAt : max;
    }, null);
    return [{
      courseId,
      name: course.name || "",
      image: course.image,
      pct: Math.min(100, Math.round((done / total) * 100)),
      hrsLeft: Math.max(0, Math.round(hours * (1 - done / total))),
      lastStudied: last ? formatDistanceToNow(last, { addSuffix: true }) : undefined,
    }];
  });
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
      image: course.image,
      price: course.price,
      addedAt: Date.now(),
    }),
  );
}
