"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthors } from "@/lib/catalog/use-authors";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import Link from "next/link";
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
import { DevModeBanner } from "@/components/commerce/dev-mode-banner";
import { useAuth } from "@/lib/auth/auth-provider";
import { usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { CATALOG_STALE_MS, exploreCourses, getCourse, listCourses } from "@/lib/catalog/queries";
import { useBatches } from "@/lib/catalog/use-batches";
import { TaxonomyPicker } from "@/components/taxonomy/taxonomy-picker";
import {
  EMPTY_SELECTION,
  filterCoursesByTaxonomy,
  selectionFromProfile,
  useTaxonomy,
  type TaxonomySelection,
} from "@/lib/taxonomy/use-taxonomy";
import { imageFor } from "@/lib/media/image-url";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import type { SettingsDoc } from "@/lib/types/firestore";
import { localizedText, usePromotions } from "@/lib/promotions/use-promotions";
import { isStoryActive } from "@/lib/stories/media";
import { cn } from "@/lib/utils";
import { loadContinueItems } from "@/lib/course/continue-items";
import { loadLiveEnrollments } from "@/lib/course/enrollments";
import { courseRuntimeLabel } from "@/lib/course/runtime";
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
  const gate = usePurchaseGate();
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  // Filter starts at the student's own university/field; they can widen it.
  const [filter, setFilter] = useState<TaxonomySelection | null>(null);
  const tax = useTaxonomy();
  const profileSelection = selectionFromProfile(profile, tax);

  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses, staleTime: CATALOG_STALE_MS });
  const offers = usePromotions();
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
    queryFn: () => loadLiveEnrollments(uid),
  });
  const continueLearning = useQuery({
    queryKey: ["continue", uid, (subs.data ?? []).map((d) => d.id).join(",")],
    enabled: Boolean(subs.data),
    queryFn: () => loadContinueItems(uid, (subs.data ?? []).map((d) => d.courseId)),
  });

  const published = exploreCourses(courses.data ?? []);
  // Start on the student's own university/field, but never on an empty list.
  const selection =
    filter ?? (filterCoursesByTaxonomy(published, profileSelection).length ? profileSelection : EMPTY_SELECTION);
  const filtered = Boolean(selection.country || selection.university || selection.category || selection.topic);
  const explore = filterCoursesByTaxonomy(published, selection);

  const authorIds = [...new Set(explore.map((c) => c.authorRef?.id).filter(Boolean))] as string[];
  const batchIds = [...new Set(explore.map((c) => c.batchesRef?.id).filter(Boolean))] as string[];

  const authors = useAuthors(authorIds);
  const batches = useBatches(batchIds);

  const hours = Math.round((stats.data?.studySeconds || 0) / 3600);
  const savedKey = (profile?.fvrtCourseList ?? []).map((ref) => ref.id).join(",");
  const savedIds = useMemo(() => new Set(savedKey ? savedKey.split(",") : []), [savedKey]);

  const exploreItems: ExploreItem[] = useMemo(
    () =>
      explore.map((course) => ({
        id: course.id,
        name: localizedField(course.name, course.nameManualTranslate, course.nameAutoTranslate, locale),
        image: courseThumb(course),
        author: course.authorRef?.id ? authors.data?.[course.authorRef.id]?.name : undefined,
        authorPhoto: course.authorRef?.id ? authors.data?.[course.authorRef.id]?.photo : undefined,
        lessons: Number(course.numberLessons || 0),
        duration: courseRuntimeLabel(course.totalVideoSeconds, { hours: t("hrs"), minutes: t("min") }),
        batch: course.batchesRef?.id ? batches.data?.[course.batchesRef.id]?.name : undefined,
        batchTone: course.batchesRef?.id ? batches.data?.[course.batchesRef.id]?.tone : undefined,
        saved: savedIds.has(course.id),
      })),
    [explore, authors.data, batches.data, locale, savedIds, t],
  );

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
    min: t("min"),
    save: t("bookmark"),
    saved: t("saved"),
  };
  const storyItems = stories.data ?? [];
  const continuePending = Boolean(subs.data) && !continueLearning.isFetched;
  const homeReady =
    courses.isFetched &&
    stories.isFetched &&
    subs.isFetched &&
    offers.isFetched &&
    !continuePending;

  return (
    <AppShell headerExtra={<StoriesRow stories={storyItems} />} loading={!homeReady} skeleton={<HomeSkeleton />}>
      <div className="flex flex-col">
        {gate.tester ? (
          <div className="pt-3 lg:pt-5">
            <DevModeBanner />
          </div>
        ) : null}
        <p className="hidden text-[20px] font-semibold text-text lg:block lg:pt-4">
          {t("hello")} {profile?.display_name || t("profile")}
        </p>

        <div className="hidden pt-4 lg:block">
          <StoriesRow stories={storyItems} fade />
        </div>

        {(continueLearning.data ?? []).length ? (
          <section className="flex flex-col gap-5 px-0 py-5">
            <h2 className="text-[14px] font-semibold text-text">{t("continueLearning")}</h2>
            <div className={exploreRailClass}>
              {(continueLearning.data ?? []).map((item) => (
                <ContinueCard key={item.courseId} item={item} labels={continueLabels} />
              ))}
            </div>
          </section>
        ) : null}

        {(offers.data ?? []).length ? (
          <Link
            href="/offers"
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#f24822]/15 px-4 py-3 lg:hidden"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text">{t("offers")}</span>
              <span className="block text-[12px] text-muted">{t("offersBanner").replace("{n}", String(offers.data?.length ?? 0))}</span>
            </span>
            <span className="grid min-w-6 place-items-center rounded-full bg-[#f24822] px-2 text-[11px] font-semibold leading-6 text-white">
              {offers.data?.length}
            </span>
          </Link>
        ) : null}

        {(offers.data ?? []).length ? (
          <section className="flex flex-col gap-5 px-0 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-text">{t("offers")}</h2>
              <Link href="/offers" prefetch className="text-[12px] font-medium text-[#0c5eff]">
                {t("offersViewAll")}
              </Link>
            </div>
            <div className={exploreRailClass}>
              {(offers.data ?? []).map((promo) => (
                <Link
                  key={promo.id}
                  href="/offers"
                  prefetch
                  className="w-[calc((100%-30px)/2.3)] shrink-0 overflow-hidden rounded-[10px] border border-line bg-surface transition-colors hover:border-muted lg:w-[calc((100%-75px)/3.5)]"
                >
                  {promo.bannerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageFor("courseCard", promo.bannerImage)}
                      alt=""
                      loading="lazy"
                      className="aspect-[2/1] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[2/1] w-full bg-surface-2" />
                  )}
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <p className="line-clamp-1 text-[12px] font-semibold text-text">
                      {localizedText(promo.name, locale) || t("offers")}
                    </p>
                    {promo.badge ? (
                      <span className="shrink-0 rounded-full bg-[#0c5eff]/15 px-2 py-0.5 text-[10px] font-medium text-[#0c5eff]">
                        {promo.badge}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-[25px] py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-text">{t("explore")}</h2>
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
                  return (
                    <ExploreListCard
                      key={item.id}
                      item={item}
                      labels={exploreLabels}
                      onEnroll={() => {}}
                      onSave={() => void toggleSave(item.id)}
                      enrollBlocked="skip"
                    />
                  );
                })}
              </div>
            ) : (
              <div className={cn(exploreGridClass, "lg:grid-cols-[repeat(auto-fill,minmax(227px,1fr))]")}>
                {exploreItems.map((item) => {
                  return (
                    <ExploreGridCard
                      key={item.id}
                      item={item}
                      labels={exploreLabels}
                      onEnroll={() => {}}
                      onSave={() => void toggleSave(item.id)}
                      enrollBlocked="skip"
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

