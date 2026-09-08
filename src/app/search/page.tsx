"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { CourseCard } from "@/components/shared/ui";
import { listCourses } from "@/lib/catalog/queries";
import { isEbookCourse } from "@/lib/format";
import { formatKwdLocale, localizedField } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

export default function SearchPage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [rating, setRating] = useState(0);
  const [sort, setSort] = useState("");
  const [topic, setTopic] = useState("");
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const remote = useQuery({
    queryKey: ["algolia", q, rating, sort],
    enabled: q.length > 1,
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&rating=${rating}&sort=${sort}`);
      return (await res.json()) as { hits?: Array<{ objectID: string; name?: string }> };
    },
  });

  const results = useMemo(() => {
    const base = (courses.data ?? []).filter((c) => !c.trashed);
    const text = q.toLowerCase();
    let rows = base.filter((c) => {
      const name = localizedField(c.name, c.nameManualTranslate, c.nameAutoTranslate, locale).toLowerCase();
      return !text || name.includes(text) || (c.subtitle || "").toLowerCase().includes(text);
    });
    if (rating) rows = rows.filter((c) => (c.totalRatting || 0) >= rating);
    if (topic) rows = rows.filter((c) => c.courseCategoryRef?.id === topic);
    rows = [...rows].sort((a, b) => {
      if (sort === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sort === "price_asc") return (a.price || 0) - (b.price || 0);
      return 0;
    });
    return rows;
  }, [courses.data, q, rating, sort, topic, locale]);

  const topics = [...new Set((courses.data ?? []).map((c) => c.courseCategoryRef?.id).filter(Boolean))] as string[];

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3 text-sm">
          <h1 className="text-lg font-semibold">{t("filter")}</h1>
          <label className="block">
            {t("rating")}
            <input type="number" min={0} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-line bg-transparent px-2 py-2" />
          </label>
          <label className="block">
            {t("priceHigh")}
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-2 py-2">
              <option value="">—</option>
              <option value="price_desc">{t("priceHigh")}</option>
              <option value="price_asc">{t("priceLow")}</option>
            </select>
          </label>
          <label className="block">
            {t("topic")}
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-bg px-2 py-2">
              <option value="">{t("all")}</option>
              {topics.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </aside>
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="mb-4 w-full rounded-full border border-line bg-transparent px-4 py-3"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((course) => (
              <CourseCard
                key={course.id}
                href={isEbookCourse(course) ? `/store/${course.id}` : `/course/${course.id}`}
                title={localizedField(course.name, course.nameManualTranslate, course.nameAutoTranslate, locale)}
                image={course.image}
                price={formatKwdLocale(course.price, locale)}
              />
            ))}
          </div>
          {remote.data?.hits?.length ? (
            <p className="mt-3 text-xs text-muted">{remote.data.hits.length} indexed</p>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
