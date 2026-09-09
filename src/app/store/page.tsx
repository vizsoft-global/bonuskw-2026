"use client";

import { useMemo, useState } from "react";
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
import { StoreSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { TaxonomyPicker } from "@/components/taxonomy/taxonomy-picker";
import {
  EMPTY_SELECTION,
  filterCoursesByTaxonomy,
  selectionFromProfile,
  useTaxonomy,
  type TaxonomySelection,
} from "@/lib/taxonomy/use-taxonomy";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { listCourses, storeEbooks } from "@/lib/catalog/queries";
import { placementOf } from "@/lib/course/status";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { ebookPageCount } from "@/lib/format";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { isStoryActive } from "@/lib/stories/media";
import type { CourseDoc, SettingsDoc } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";

export default function StorePage() {
  const { t, locale } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<TaxonomySelection | null>(null);
  const tax = useTaxonomy();
  const profileSelection = selectionFromProfile(profile, tax);

  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const stories = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const snap = await getDocs(collection(getDb(), collections.settings));
      const main = snap.docs.find((d) => d.get("type") === "Main")?.data() as SettingsDoc | undefined;
      return (main?.settings_status ?? []).filter(isStoryActive);
    },
  });
  const stats = useQuery({
    queryKey: ["stats", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDoc(doc(getDb(), collections.userStats, user!.uid));
      return snap.data() as { streakDays?: number; studySeconds?: number } | undefined;
    },
  });
  const subs = useQuery({
    queryKey: ["subs", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.subscription), where("userRef", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs.filter((d) => d.get("status") === "Ongoing");
    },
  });
  const books = storeEbooks(courses.data ?? []);
  const featured = books.filter((book) => placementOf(book) === "Featured");
  // Start on the student's own university/field, but never on an empty list.
  const selection =
    filter ?? (filterCoursesByTaxonomy(books, profileSelection).length ? profileSelection : EMPTY_SELECTION);
  const filtered = Boolean(selection.country || selection.university || selection.category || selection.topic);
  const explore = filterCoursesByTaxonomy(books, selection);

  const authorIds = [...new Set([...featured, ...explore].map((c) => c.authorRef?.id).filter(Boolean))] as string[];
  const authors = useQuery({
    queryKey: ["authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        authorIds.map(async (id) => {
          const snap = await getDoc(doc(getDb(), collections.users, id));
          return [id, String(snap.get("display_name") || "")] as const;
        }),
      );
      return Object.fromEntries(pairs) as Record<string, string>;
    },
  });

  const hours = Math.round((stats.data?.studySeconds || 0) / 3600);
  const savedKey = (profile?.fvrtCourseList ?? []).map((ref) => ref.id).join(",");
  const savedIds = useMemo(() => new Set(savedKey ? savedKey.split(",") : []), [savedKey]);

  function toItem(book: CourseDoc & { id: string }): ExploreItem {
    const pages = ebookPageCount(book);
    return {
      id: book.id,
      name: localizedField(book.name, book.nameManualTranslate, book.nameAutoTranslate, locale),
      image: book.image,
      rating: Number(book.totalRatting || 0),
      author: book.authorRef?.id ? authors.data?.[book.authorRef.id] : undefined,
      pages: pages > 0 ? pages : undefined,
      saved: savedIds.has(book.id),
      href: `/store/${book.id}`,
      aspect: "3/4",
    };
  }

  const featuredItems = featured.map(toItem);
  const exploreItems = explore.map(toItem);

  async function addEbook(book: CourseDoc & { id: string }) {
    if (!user) {
      router.push("/login");
      return;
    }
    await addEbookToCart(user.uid, book);
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

  const statsLabels = {
    myStats: t("myStats"),
    streak: t("streak"),
    activeCourses: t("activeCourses"),
    studyTime: t("studyTime"),
    daysUnit: t("daysUnit"),
    coursesUnit: t("coursesUnit"),
    hoursUnit: t("hoursUnit"),
  };
  const cardLabels = {
    enroll: t("addToCart"),
    lessons: t("lessons"),
    hrs: t("hrs"),
    save: t("bookmark"),
    saved: t("saved"),
    pages: t("pages"),
  };
  const storyItems = stories.data ?? [];

  return (
    <AppShell headerExtra={<StoriesRow stories={storyItems} />} loading={courses.isPending} skeleton={<StoreSkeleton />}>
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

        {featuredItems.length ? (
          <section className="flex flex-col gap-5 px-0 py-5">
            <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("featuredEbooks")}</h2>
            <div className={exploreRailClass}>
              {featuredItems.map((item) => {
                const book = featured.find((b) => b.id === item.id);
                return (
                  <div key={item.id} className="w-[164px] shrink-0 lg:w-[227px]">
                    <ExploreGridCard
                      item={item}
                      labels={cardLabels}
                      onEnroll={() => book && void addEbook(book)}
                      onSave={() => void toggleSave(item.id)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-[25px] py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#fafafa]">{t("exploreEbooks")}</h2>
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
                  const book = explore.find((b) => b.id === item.id);
                  return (
                    <ExploreListCard
                      key={item.id}
                      item={item}
                      labels={cardLabels}
                      onEnroll={() => book && void addEbook(book)}
                      onSave={() => void toggleSave(item.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className={cn(exploreGridClass, "lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")}>
                {exploreItems.map((item) => {
                  const book = explore.find((b) => b.id === item.id);
                  return (
                    <ExploreGridCard
                      key={item.id}
                      item={item}
                      labels={cardLabels}
                      onEnroll={() => book && void addEbook(book)}
                      onSave={() => void toggleSave(item.id)}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <EmptyState
              icon="/profile/book.svg"
              title={t("emptyStoreTitle")}
              body={t("emptyStoreBody")}
              cta={filtered ? { onClick: () => setFilter(EMPTY_SELECTION), label: t("viewAll") } : { href: "/", label: t("explore") }}
            />
          )}
        </section>
      </div>
    </AppShell>
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
