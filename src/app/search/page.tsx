"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthors } from "@/lib/catalog/use-authors";
import { ArrowUpDown, Clock, Shapes, X } from "lucide-react";
import { arrayRemove, arrayUnion, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { HomeIcon } from "@/components/home/icon";
import { ExploreGridCard, exploreGridClass, type ExploreItem } from "@/components/home/explore-card";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { purchaseKindFor, usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { addCourseLine, enrolmentClosedMessage } from "@/lib/cart/add-course";
import { toast } from "@/components/ui/toaster";
import { listCourses, publishedCourses } from "@/lib/catalog/queries";
import { useBatches } from "@/lib/catalog/use-batches";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { isEbookCourse } from "@/lib/format";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { useTaxonomy } from "@/lib/taxonomy/use-taxonomy";
import {
  clearRecentSearches,
  loadRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from "@/lib/search/recents";
import type { CourseDoc } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";
import { courseRuntimeLabel } from "@/lib/course/runtime";
import { courseThumb } from "@/lib/course/thumb";

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full appearance-none rounded-xl border border-line bg-surface py-2.5 ps-3 pe-10 text-text"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute end-3 top-[calc(50%+2px)] size-3.5 -translate-y-1/2 rotate-90">
        <HomeIcon src="/home/chevron.svg" />
      </span>
    </div>
  );
}

export default function SearchPage() {
  const { t, locale } = useI18n();
  const tax = useTaxonomy();
  const { user, profile, refreshProfile } = useAuth();
  const gate = usePurchaseGate();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");
  const [topic, setTopic] = useState("");
  const [focused, setFocused] = useState(true);
  const [recents, setRecents] = useState<string[]>([]);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  function focusInput() {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    (mobile ? mobileInputRef : desktopInputRef).current?.focus();
  }

  /**
   * Recents are loaded when the box is focused, not in a mount effect:
   * localStorage does not exist while the page prerenders, and setting state
   * from an effect re-rendered the whole result list on every entry — which is
   * what made coming back to this page feel stuck.
   */
  function onInputFocus() {
    setRecents(loadRecentSearches());
    setFocused(true);
  }

  useEffect(() => {
    focusInput();
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    const timer = window.setTimeout(() => {
      setRecents(saveRecentSearch(text));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [q]);

  function commitQuery(value = q) {
    const text = value.trim();
    if (text.length < 2) return;
    setRecents(saveRecentSearch(text));
  }

  /**
   * The whole catalogue, cached. With no staleTime this refetched 500+ course
   * documents on every entry to the page — including coming back from a course —
   * which is what made the box feel stuck until a reload.
   */
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    staleTime: 5 * 60_000,
  });
  // Instructor names so "ahmed" also finds every course Dr Ahmed teaches.
  const instructors = useQuery({
    queryKey: ["search-instructors"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.users), where("userRole", "==", "Instructor")),
      );
      const out: Record<string, string> = {};
      for (const d of snap.docs) {
        const data = d.data() as { display_name?: string; firstName?: string; lastName?: string };
        out[d.id] = data.display_name || `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
      }
      return out;
    },
  });
  // Results are matched locally against the catalogue above; the Algolia call
  // that used to sit here fired a request per keystroke and only fed a debug
  // count, so it is gone (the /api/search route stays for whoever wants it).

  const results = useMemo(() => {
    // Every published course on the platform, whatever university it belongs
    // to — search is the one place the profile's taxonomy never narrows.
    const base = publishedCourses(courses.data ?? []);
    // Wild match: case/accent-insensitive, every typed word must appear in the
    // course name (any language), subtitle, SKU or instructor name.
    const words = normalizeSearch(q).split(" ").filter(Boolean);
    let rows = base.filter((c) => {
      if (!words.length) return true;
      const hay = normalizeSearch(
        [
          c.name,
          c.nameManualTranslate?.en,
          c.nameManualTranslate?.ar,
          c.nameAutoTranslate?.en,
          c.nameAutoTranslate?.ar,
          c.subtitle,
          c.sku,
          c.authorRef?.id ? instructors.data?.[c.authorRef.id] : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return words.every((w) => hay.includes(w));
    });
    if (topic) rows = rows.filter((c) => c.branchRef?.id === topic);
    rows = [...rows].sort((a, b) => {
      if (sort === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sort === "price_asc") return (a.price || 0) - (b.price || 0);
      return 0;
    });
    return rows;
  }, [courses.data, instructors.data, q, sort, topic]);

  // Topics that at least one course is filed under, shown by name.
  const topicIds = new Set((courses.data ?? []).map((c) => c.branchRef?.id).filter(Boolean));
  const topics = tax.topics.filter((b) => topicIds.has(b.id));
  const showRecents = recents.length > 0 && (focused || !q.trim());

  const authorIds = [...new Set(results.map((c) => c.authorRef?.id).filter(Boolean))] as string[];
  const batchIds = [...new Set(results.map((c) => c.batchesRef?.id).filter(Boolean))] as string[];
  const authors = useAuthors(authorIds);
  const batches = useBatches(batchIds);

  const savedKey = (profile?.fvrtCourseList ?? []).map((ref) => ref.id).join(",");
  const savedIds = useMemo(() => new Set(savedKey ? savedKey.split(",") : []), [savedKey]);

  const items: ExploreItem[] = useMemo(
    () =>
      results.map((course) => ({
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
        href: isEbookCourse(course) ? `/store/${course.id}` : `/course/${course.id}`,
      })),
    [results, authors.data, batches.data, locale, savedIds, t],
  );

  const exploreLabels = {
    enroll: t("enroll"),
    lessons: t("lessons"),
    min: t("min"),
    save: t("bookmark"),
    saved: t("saved"),
  };

  async function enrol(course: CourseDoc & { id: string }) {
    if (!user || gate.blockFor(purchaseKindFor(course))) return;
    try {
      await addCourseLine(user.uid, course);
    } catch (err) {
      toast.error(enrolmentClosedMessage(err, t));
      return;
    }
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

  return (
    <AppShell
      loading={courses.isPending}
      title={t("searchTitle")}
      skeleton={<SearchSkeleton />}
      searchField={
        <input
          ref={mobileInputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={onInputFocus}
          onBlur={() => {
            setFocused(false);
            commitQuery();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitQuery();
            }
          }}
          placeholder={t("search")}
          className="h-11 w-full bg-transparent text-[14px] text-text outline-none placeholder:text-muted"
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden space-y-4 rounded-[16px] border border-line bg-surface p-4 text-sm lg:block">
          <h2 className="text-lg font-semibold">{t("filter")}</h2>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-muted">
              <ArrowUpDown className="size-4" />
              {t("sort")}
            </span>
            <FilterSelect value={sort} onChange={setSort}>
              <option value="">—</option>
              <option value="price_desc">{t("priceHigh")}</option>
              <option value="price_asc">{t("priceLow")}</option>
            </FilterSelect>
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-muted">
              <Shapes className="size-4" />
              {t("topic")}
            </span>
            <FilterSelect value={topic} onChange={setTopic}>
              <option value="">{t("all")}</option>
              {topics.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </FilterSelect>
          </label>
        </aside>
        <div>
          <label
            className={cn(
              "mt-2 hidden h-[51px] w-full items-center gap-2.5 rounded-[47px] border-[0.5px] bg-black/25 px-[15px] backdrop-blur-[15px] transition lg:flex",
              focused
                ? "border-[#f6360b]/70 ring-2 ring-[#f6360b]/30"
                : "border-line",
            )}
          >
            <span className="size-5 shrink-0">
              <HomeIcon src="/home/search.svg" />
            </span>
            <input
              ref={desktopInputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={onInputFocus}
              onBlur={() => {
                setFocused(false);
                commitQuery();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQuery();
                }
              }}
              placeholder={t("search")}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-muted"
            />
          </label>
          {showRecents ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] text-muted">
                  <Clock className="size-3.5" />
                  {t("recentSearches")}
                </p>
                <button
                  type="button"
                  onClick={() => setRecents(clearRecentSearches())}
                  className="text-[12px] text-muted hover:text-text"
                >
                  {t("clear")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((item) => (
                  <span
                    key={item}
                    className="flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface-2 py-1 ps-3 pe-1.5 text-[12px] text-text"
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQ(item);
                        commitQuery(item);
                        focusInput();
                      }}
                    >
                      {item}
                    </button>
                    <button
                      type="button"
                      aria-label={t("clear")}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setRecents(removeRecentSearch(item))}
                      className="grid size-8 place-items-center rounded-full text-muted hover:text-text"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {items.length ? (
            <div className={cn("mt-5", exploreGridClass, "lg:grid-cols-[repeat(auto-fill,minmax(227px,1fr))]")}>
              {items.map((item) => {
                const course = results.find((c) => c.id === item.id);
                return (
                  <ExploreGridCard
                    key={item.id}
                    item={item}
                    labels={exploreLabels}
                    onEnroll={() => course && void enrol(course)}
                    onSave={() => void toggleSave(item.id)}
                    enrollBlocked={course ? gate.blockFor(purchaseKindFor(course)) : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState icon="/home/search.svg" title={t("emptySearchTitle")} body={t("emptySearchBody")} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
