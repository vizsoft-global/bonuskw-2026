"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthors } from "@/lib/catalog/use-authors";
import { Clock, SlidersHorizontal, X } from "lucide-react";
import { arrayRemove, arrayUnion, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { HomeIcon } from "@/components/home/icon";
import { ExploreGridCard, type ExploreItem } from "@/components/home/explore-card";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { purchaseKindFor, usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { addCourseLine, enrolmentClosedMessage } from "@/lib/cart/add-course";
import { useOwnership } from "@/lib/cart/ownership";
import { toast } from "@/components/ui/toaster";
import { openCart } from "@/components/cart/cart-panel";
import { listCourses, publishedCourses } from "@/lib/catalog/queries";
import { useBatches } from "@/lib/catalog/use-batches";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { asDate, isEbookCourse } from "@/lib/format";
import { localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { filterCoursesByTaxonomy, optionsFor, useTaxonomy, type TaxonomySelection } from "@/lib/taxonomy/use-taxonomy";
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

type FilterOption = { value: string; label: string; count?: number };

/** One titled list in the filter panel; tapping the chosen row clears it. */
function FilterGroup({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-2 text-[13px] font-semibold text-text">{title}</h3>
      <ul className={cn("flex flex-col", options.length > 7 && "max-h-56 overflow-y-auto pe-1")}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => onChange(active ? "" : option.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-[13px] transition-colors",
                  active ? "bg-surface-2 font-medium text-text" : "text-muted hover:text-text",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "grid size-3.5 shrink-0 place-items-center rounded-full border",
                      active ? "border-[#f24822]" : "border-line",
                    )}
                  >
                    {active ? <span className="size-1.5 rounded-full bg-[#f24822]" /> : null}
                  </span>
                  <span className="truncate">{option.label}</span>
                </span>
                {option.count !== undefined ? <span className="shrink-0 text-[11px] text-muted">{option.count}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const COLS_KEY = "ba-search-cols";
const COLS_EVENT = "ba-search-cols";

function subscribeCols(onChange: () => void) {
  window.addEventListener(COLS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCols() {
  const saved = Number(window.localStorage.getItem(COLS_KEY));
  return saved >= 3 && saved <= 6 ? saved : 5;
}

function saveCols(n: number) {
  window.localStorage.setItem(COLS_KEY, String(n));
  window.dispatchEvent(new Event(COLS_EVENT));
}

function countBy<T>(rows: T[], key: (row: T) => string | undefined) {
  const out = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    if (id) out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

export default function SearchPage() {
  const { t, locale } = useI18n();
  const tax = useTaxonomy();
  const { user, profile, refreshProfile } = useAuth();
  const gate = usePurchaseGate();
  const own = useOwnership();
  const router = useRouter();
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const searching = deferredQ !== q;
  const cols = useSyncExternalStore(subscribeCols, readCols, () => 5);
  const [sort, setSort] = useState("");
  const [taxSel, setTaxSel] = useState<TaxonomySelection>({ country: "", university: "", category: "", topic: "" });
  const [kind, setKind] = useState("");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState("");
  const [term, setTerm] = useState("");
  const [instructor, setInstructor] = useState("");
  const [focused, setFocused] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  function focusInput() {
    desktopInputRef.current?.focus();
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

  const matched = useMemo(() => {
    const base = publishedCourses(courses.data ?? []);
    const words = normalizeSearch(deferredQ).split(" ").filter(Boolean);
    const rows = base.filter((c) => {
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
    return filterCoursesByTaxonomy(rows, taxSel).filter((c) => {
      if (kind === "ebook" && !isEbookCourse(c)) return false;
      if (kind === "course" && isEbookCourse(c)) return false;
      const free = c.coursePaymentType === "Free" || !(Number(c.price) > 0);
      if (price === "free" && !free) return false;
      if (price === "paid" && free) return false;
      if (payment === "emi" && !c.emiPaymentStatus) return false;
      if (instructor && c.authorRef?.id !== instructor) return false;
      return true;
    });
  }, [courses.data, instructors.data, deferredQ, taxSel, kind, price, payment, instructor]);

  const batchIds = [...new Set(matched.map((c) => c.batchesRef?.id).filter(Boolean))] as string[];
  const batches = useBatches(batchIds);

  const results = useMemo(() => {
    const rows = matched.filter((c) => {
      if (!term) return true;
      const tone = c.batchesRef?.id ? batches.data?.[c.batchesRef.id]?.tone : undefined;
      return tone === term;
    });
    return [...rows].sort((a, b) => {
      if (sort === "newest") {
        const left = asDate((a as CourseDoc & { created_time?: unknown }).created_time)?.getTime() ?? 0;
        const right = asDate((b as CourseDoc & { created_time?: unknown }).created_time)?.getTime() ?? 0;
        return right - left;
      }
      if (sort === "popular") return (b.studentCount || 0) - (a.studentCount || 0);
      if (sort === "rating") return (b.totalRatting || 0) - (a.totalRatting || 0);
      if (sort === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sort === "price_asc") return (a.price || 0) - (b.price || 0);
      return 0;
    });
  }, [matched, batches.data, term, sort]);

  const optionPool = filterCoursesByTaxonomy(publishedCourses(courses.data ?? []), {
    country: taxSel.country,
    university: taxSel.university,
    category: taxSel.category,
    topic: "",
  });
  const present = {
    country: new Set(publishedCourses(courses.data ?? []).map((c) => c.countryRef?.id).filter(Boolean)),
    university: new Set(optionPool.map((c) => c.universityRef?.id).filter(Boolean)),
    category: new Set(optionPool.map((c) => c.categoryRef?.id).filter(Boolean)),
    topic: new Set(optionPool.map((c) => c.branchRef?.id).filter(Boolean)),
  };
  const taxOptions = optionsFor(tax, taxSel);
  const countries = taxOptions.countries.filter((item) => present.country.has(item.id));
  const universities = taxOptions.universities.filter((item) => present.university.has(item.id));
  const categories = taxOptions.categories.filter((item) => present.category.has(item.id));
  const topics = taxOptions.topics.filter((item) => present.topic.has(item.id));
  const instructorIds = [...new Set(optionPool.map((c) => c.authorRef?.id).filter(Boolean))] as string[];
  const showRecents = recents.length > 0 && (focused || !q.trim());

  const authorIds = [...new Set(results.map((c) => c.authorRef?.id).filter(Boolean))] as string[];
  const authors = useAuthors(authorIds);

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
    }
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

  function clearFilters() {
    setSort("");
    setTaxSel({ country: "", university: "", category: "", topic: "" });
    setKind("");
    setPrice("");
    setPayment("");
    setTerm("");
    setInstructor("");
  }

  const sortLabel =
    sort === "newest" ? t("searchNewest")
    : sort === "popular" ? t("searchPopular")
    : sort === "rating" ? t("rating")
    : sort === "price_desc" ? t("priceHigh")
    : sort === "price_asc" ? t("priceLow")
    : "";
  const chips: { id: string; label: string; clear: () => void }[] = [];
  if (sortLabel) chips.push({ id: "sort", label: sortLabel, clear: () => setSort("") });
  const countryName = countries.find((item) => item.id === taxSel.country)?.name;
  const universityName = universities.find((item) => item.id === taxSel.university)?.name;
  const categoryName = categories.find((item) => item.id === taxSel.category)?.name;
  const topicName = topics.find((item) => item.id === taxSel.topic)?.name;
  if (countryName) chips.push({ id: "country", label: countryName, clear: () => setTaxSel({ country: "", university: "", category: "", topic: "" }) });
  if (universityName) chips.push({ id: "university", label: universityName, clear: () => setTaxSel((s) => ({ ...s, university: "", category: "", topic: "" })) });
  if (categoryName) chips.push({ id: "category", label: categoryName, clear: () => setTaxSel((s) => ({ ...s, category: "", topic: "" })) });
  if (topicName) chips.push({ id: "topic", label: topicName, clear: () => setTaxSel((s) => ({ ...s, topic: "" })) });
  if (kind) chips.push({ id: "kind", label: kind === "ebook" ? t("searchEbooks") : t("searchCourses"), clear: () => setKind("") });
  if (price) chips.push({ id: "price", label: price === "free" ? t("searchFree") : t("searchPaid"), clear: () => setPrice("") });
  if (payment) chips.push({ id: "payment", label: t("searchEmi"), clear: () => setPayment("") });
  if (term) chips.push({ id: "term", label: term === "upcoming" ? t("searchUpcoming") : t("searchOpen"), clear: () => setTerm("") });
  const instructorName = instructor ? instructors.data?.[instructor] : "";
  if (instructorName) chips.push({ id: "instructor", label: instructorName, clear: () => setInstructor("") });

  const countries_ = countBy(optionPool, (c) => c.countryRef?.id);
  const universities_ = countBy(optionPool, (c) => c.universityRef?.id);
  const categories_ = countBy(optionPool, (c) => c.categoryRef?.id);
  const topics_ = countBy(optionPool, (c) => c.branchRef?.id);
  const instructors_ = countBy(optionPool, (c) => c.authorRef?.id);

  const filterPanel = (
    <div className="flex flex-col">
      <FilterGroup
        title={t("sort")}
        value={sort}
        onChange={setSort}
        options={[
          { value: "newest", label: t("searchNewest") },
          { value: "popular", label: t("searchPopular") },
          { value: "rating", label: t("rating") },
          { value: "price_asc", label: t("priceLow") },
          { value: "price_desc", label: t("priceHigh") },
        ]}
      />
      <FilterGroup
        title={t("searchType")}
        value={kind}
        onChange={setKind}
        options={[
          { value: "course", label: t("searchCourses") },
          { value: "ebook", label: t("searchEbooks") },
        ]}
      />
      <FilterGroup
        title={t("searchPrice")}
        value={price}
        onChange={setPrice}
        options={[
          { value: "free", label: t("searchFree") },
          { value: "paid", label: t("searchPaid") },
        ]}
      />
      <FilterGroup
        title={t("searchPayment")}
        value={payment}
        onChange={setPayment}
        options={[{ value: "emi", label: t("searchEmi") }]}
      />
      <FilterGroup
        title={t("searchTerm")}
        value={term}
        onChange={setTerm}
        options={[
          { value: "active", label: t("searchOpen") },
          { value: "upcoming", label: t("searchUpcoming") },
        ]}
      />
      <FilterGroup
        title={t("country")}
        value={taxSel.country}
        onChange={(country) => setTaxSel({ country, university: "", category: "", topic: "" })}
        options={countries.map((item) => ({ value: item.id, label: item.name, count: countries_.get(item.id) }))}
      />
      <FilterGroup
        title={t("university")}
        value={taxSel.university}
        onChange={(university) => setTaxSel((s) => ({ ...s, university, category: "", topic: "" }))}
        options={universities.map((item) => ({ value: item.id, label: item.name, count: universities_.get(item.id) }))}
      />
      <FilterGroup
        title={t("category")}
        value={taxSel.category}
        onChange={(category) => setTaxSel((s) => ({ ...s, category, topic: "" }))}
        options={categories.map((item) => ({ value: item.id, label: item.name, count: categories_.get(item.id) }))}
      />
      <FilterGroup
        title={t("topic")}
        value={taxSel.topic}
        onChange={(topic) => setTaxSel((s) => ({ ...s, topic }))}
        options={topics.map((item) => ({ value: item.id, label: item.name, count: topics_.get(item.id) }))}
      />
      <FilterGroup
        title={t("instructor")}
        value={instructor}
        onChange={setInstructor}
        options={instructorIds
          .filter((id) => instructors.data?.[id])
          .map((id) => ({ value: id, label: instructors.data![id], count: instructors_.get(id) }))
          .sort((a, b) => a.label.localeCompare(b.label))}
      />
    </div>
  );

  return (
    <AppShell loading={courses.isPending} title={t("searchTitle")} skeleton={<SearchSkeleton />}>
      <div className="pt-2 pb-20 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:pt-6 lg:pb-0">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pe-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-text">{t("searchFilters")}</h2>
              {chips.length ? (
                <button type="button" onClick={clearFilters} className="text-[12px] text-muted hover:text-text">
                  {t("clearAll")}
                </button>
              ) : null}
            </div>
            {filterPanel}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <label
            className={cn(
              "flex h-11 w-full items-center gap-2.5 rounded-full border bg-surface px-4",
              focused ? "border-[#f6360b]/70" : "border-line",
            )}
          >
            <span className="size-4 shrink-0">
              {searching ? (
                <span className="block size-4 animate-spin rounded-full border-2 border-line border-t-[#f24822]" />
              ) : (
                <HomeIcon src="/home/search.svg" />
              )}
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
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12px] text-muted">
                  <Clock className="size-3.5" />
                  {t("recentSearches")}
                </p>
                <button type="button" onClick={() => setRecents(clearRecentSearches())} className="text-[12px] text-muted hover:text-text">
                  {t("clear")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recents.map((item) => (
                  <span key={item} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 ps-3 pe-1.5 text-[12px] text-text">
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
                      className="grid size-7 place-items-center rounded-full text-muted hover:text-text"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <p className="text-[13px] text-muted">{t("searchResults", { count: results.length })}</p>
            <div className="hidden items-center gap-1 text-[13px] lg:flex">
              <span className="me-1 text-muted">{t("searchShow")}:</span>
              {[3, 4, 5, 6].map((n, index) => (
                <span key={n} className="flex items-center">
                  {index ? <span className="px-1 text-line">/</span> : null}
                  <button
                    type="button"
                    onClick={() => saveCols(n)}
                    className={cn(
                      "px-1 transition-colors",
                      cols === n ? "font-semibold text-text underline underline-offset-4" : "text-muted hover:text-text",
                    )}
                  >
                    {n}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {chips.length > 0 ? (
            <div className="-mt-1 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-[12px] text-text hover:border-muted"
                >
                  {chip.label}
                  <X className="size-3 text-muted" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="px-1 text-[12px] text-muted underline-offset-4 hover:text-text hover:underline">
                {t("clearAll")}
              </button>
            </div>
          ) : null}

          {items.length ? (
            <div
              className={cn(
                "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3",
                cols === 3 && "lg:grid-cols-3",
                cols === 4 && "lg:grid-cols-4",
                cols === 5 && "lg:grid-cols-5",
                cols === 6 && "lg:grid-cols-6",
              )}
            >
              {items.map((item, index) => {
                const course = results.find((c) => c.id === item.id);
                const blocked =
                  own.labelOf(item.id) ?? (!course || isEbookCourse(course) ? "skip" : gate.blockFor(purchaseKindFor(course)));
                return (
                  <ExploreGridCard
                    key={item.id}
                    item={item}
                    labels={exploreLabels}
                    enrollOnImage
                    priority={index < 4}
                    onEnroll={() => course && void enrol(course)}
                    onSave={() => void toggleSave(item.id)}
                    enrollBlocked={blocked || undefined}
                  />
                );
              })}
            </div>
          ) : courses.isFetched && !searching ? (
            <EmptyState icon="/home/search.svg" title={t("emptySearchTitle")} body={t("emptySearchBody")} />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDrawer(true)}
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 mx-auto flex h-11 w-fit items-center gap-2 rounded-full bg-text px-5 text-[13px] font-semibold text-bg shadow-[0_8px_24px_rgba(0,0,0,0.35)] active:scale-95 lg:hidden"
      >
        <SlidersHorizontal className="size-4" />
        {t("searchFilters")}
        {chips.length ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-[#f24822] px-1.5 text-[11px] leading-5 text-white">
            {chips.length}
          </span>
        ) : null}
      </button>

      {drawer ? createPortal(
        <div className="fixed inset-0 z-[110] lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 end-0 flex w-[86%] max-w-sm flex-col bg-surface pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold text-text">{t("searchFilters")}</h2>
              <button type="button" onClick={() => setDrawer(false)} className="flex items-center gap-1 text-[13px] text-text">
                <X className="size-4" />
                {t("close")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{filterPanel}</div>
            <div className="flex gap-2 border-t border-line px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 flex-1 rounded-full border border-line text-[13px] text-text"
              >
                {t("clearAll")}
              </button>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="h-11 flex-[2] rounded-full bg-[#0c5eff] text-[13px] font-semibold text-white"
              >
                {t("searchShowResults", { count: results.length })}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </AppShell>
  );
}
