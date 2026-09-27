"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthors } from "@/lib/catalog/use-authors";
import { Clock, X } from "lucide-react";
import { arrayRemove, arrayUnion, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { HomeIcon } from "@/components/home/icon";
import { ExploreGridCard, type ExploreItem } from "@/components/home/explore-card";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { purchaseKindFor, usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { addCourseLine, enrolmentClosedMessage } from "@/lib/cart/add-course";
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
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-full border border-line bg-surface py-0 ps-3 pe-8 text-[12px] text-text"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute end-2.5 top-1/2 size-3 -translate-y-1/2 rotate-90">
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
  const deferredQ = useDeferredValue(q);
  const searching = deferredQ !== q;
  const [cols, setCols] = useState(5);
  const [sort, setSort] = useState("");
  const [taxSel, setTaxSel] = useState<TaxonomySelection>({ country: "", university: "", category: "", topic: "" });
  const [kind, setKind] = useState("");
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState("");
  const [term, setTerm] = useState("");
  const [instructor, setInstructor] = useState("");
  const [focused, setFocused] = useState(true);
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
    const saved = Number(window.localStorage.getItem("ba-search-cols"));
    if (saved >= 3 && saved <= 6) setCols(saved);
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
      return;
    }
    toast.success(t("addedToCart"), { action: { label: t("viewCart"), onClick: () => openCart() } });
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

  return (
    <AppShell loading={courses.isPending} title={t("searchTitle")} skeleton={<SearchSkeleton />}>
      <div className="flex flex-col gap-3 pt-2 lg:pt-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
        <label
          className={cn(
            "flex h-11 w-full shrink-0 items-center gap-2.5 rounded-full border bg-surface px-4 lg:w-80",
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

        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:flex-wrap lg:overflow-visible lg:px-0">
          <FilterSelect value={taxSel.country} onChange={(country) => setTaxSel({ country, university: "", category: "", topic: "" })}>
            <option value="">{t("country")}</option>
            {countries.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={taxSel.university} onChange={(university) => setTaxSel((s) => ({ ...s, university, category: "", topic: "" }))}>
            <option value="">{t("university")}</option>
            {universities.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={taxSel.category} onChange={(category) => setTaxSel((s) => ({ ...s, category, topic: "" }))}>
            <option value="">{t("category")}</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={taxSel.topic} onChange={(topic) => setTaxSel((s) => ({ ...s, topic }))}>
            <option value="">{t("topic")}</option>
            {topics.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={kind} onChange={setKind}>
            <option value="">{t("searchType")}</option>
            <option value="course">{t("searchCourses")}</option>
            <option value="ebook">{t("searchEbooks")}</option>
          </FilterSelect>
          <FilterSelect value={price} onChange={setPrice}>
            <option value="">{t("searchPrice")}</option>
            <option value="free">{t("searchFree")}</option>
            <option value="paid">{t("searchPaid")}</option>
          </FilterSelect>
          <FilterSelect value={payment} onChange={setPayment}>
            <option value="">{t("searchPayment")}</option>
            <option value="emi">{t("searchEmi")}</option>
          </FilterSelect>
          <FilterSelect value={term} onChange={setTerm}>
            <option value="">{t("searchTerm")}</option>
            <option value="active">{t("searchOpen")}</option>
            <option value="upcoming">{t("searchUpcoming")}</option>
          </FilterSelect>
          <FilterSelect value={instructor} onChange={setInstructor}>
            <option value="">{t("instructor")}</option>
            {instructorIds.map((id) => (
              <option key={id} value={id}>{instructors.data?.[id] || id}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={sort} onChange={setSort}>
            <option value="">{t("sort")}</option>
            <option value="newest">{t("searchNewest")}</option>
            <option value="popular">{t("searchPopular")}</option>
            <option value="rating">{t("rating")}</option>
            <option value="price_asc">{t("priceLow")}</option>
            <option value="price_desc">{t("priceHigh")}</option>
          </FilterSelect>
          <span className="ms-auto hidden shrink-0 items-center gap-1 lg:inline-flex">
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setCols(n);
                  window.localStorage.setItem("ba-search-cols", String(n));
                }}
                className={cn("grid size-8 place-items-center rounded-full text-[12px]", cols === n ? "bg-text text-bg" : "bg-surface-2 text-muted")}
              >
                {n}
              </button>
            ))}
          </span>
        </div>
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.clear}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12px] text-text"
              >
                {chip.label}
                <X className="size-3 text-muted" />
              </button>
            ))}
            <span className="text-[12px] text-muted">{t("searchResults", { count: results.length })}</span>
            <button type="button" onClick={clearFilters} className="text-[12px] text-muted hover:text-text">
              {t("clearAll")}
            </button>
          </div>
        ) : null}

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

        {items.length ? (
          <div className={cn("grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3", cols === 3 && "lg:grid-cols-3", cols === 4 && "lg:grid-cols-4", cols === 5 && "lg:grid-cols-5", cols === 6 && "lg:grid-cols-6")}>
            {items.map((item, index) => {
              const course = results.find((c) => c.id === item.id);
              const blocked = !course || isEbookCourse(course) ? "skip" : gate.blockFor(purchaseKindFor(course));
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
    </AppShell>
  );
}
