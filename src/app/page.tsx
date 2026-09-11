"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ContinueCard } from "@/components/home/continue-card";
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
import { TaxonomyPicker } from "@/components/taxonomy/taxonomy-picker";
import {
  EMPTY_SELECTION,
  filterCoursesByTaxonomy,
  selectionFromProfile,
  useTaxonomy,
  type TaxonomySelection,
} from "@/lib/taxonomy/use-taxonomy";
import { upsertLine, loadCart, saveCart } from "@/lib/cart/store";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { CourseDoc, SettingsDoc } from "@/lib/types/firestore";
import { isStoryActive } from "@/lib/stories/media";
import { cn } from "@/lib/utils";
import { loadContinueItems } from "@/lib/course/continue-items";
import { courseThumb } from "@/lib/course/thumb";

const SPLASH_KEY = "ba_splash_done";
let splashPlayed = false;

export default function HomePage() {
  const { user, ready, needsOnboarding, kicked } = useAuth();
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

  return <HomeBody uid={user.uid} />;
}

function HomeBody({ uid }: { uid: string }) {
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  // Filter starts at the student's own university/field; they can widen it.
  const [filter, setFilter] = useState<TaxonomySelection | null>(null);
  const tax = useTaxonomy();
  const profileSelection = selectionFromProfile(profile, tax);

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
      return (snap.data() as { streakDays?: number; studySeconds?: number } | undefined) ?? null;
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
  const continueLearning = useQuery({
    queryKey: ["continue", uid, (subs.data ?? []).map((d) => d.id).join(",")],
    enabled: Boolean(subs.data),
    queryFn: () => loadContinueItems(uid, (subs.data ?? []).map((d) => d.get("courseRef")?.id as string | undefined)),
  });

  const published = exploreCourses(courses.data ?? []);
  // Start on the student's own university/field, but never on an empty list.
  const selection =
    filter ?? (filterCoursesByTaxonomy(published, profileSelection).length ? profileSelection : EMPTY_SELECTION);
  const filtered = Boolean(selection.country || selection.university || selection.category || selection.topic);
  const explore = filterCoursesByTaxonomy(published, selection);

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
        image: courseThumb(course),
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
    watchedMin: t("watchedMin"),
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

          <TaxonomyPicker value={selection} onChange={setFilter} />

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
              title={filtered ? t("emptyExploreTopicTitle") : t("emptyExploreTitle")}
              body={filtered ? t("emptyExploreTopicBody") : t("emptyExploreBody")}
              cta={filtered ? { onClick: () => setFilter(EMPTY_SELECTION), label: t("viewAll") } : undefined}
            />
          )}
        </section>
      </div>
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
