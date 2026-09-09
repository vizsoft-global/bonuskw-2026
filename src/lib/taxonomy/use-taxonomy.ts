"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, type DocumentReference } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { CourseDoc } from "@/lib/types/firestore";

/*
 * One universal tree for every course and student:
 *   Country → University → Category → Topic
 * A high school is a university with `type: "school"`; its categories are
 * grades (10th, 12th…) and its topics are subjects.
 */

export const SCHOOL_TYPE = "school";

export type TaxNode = {
  id: string;
  name: string;
  image?: string;
  countryId?: string;
  universityId?: string;
  categoryId?: string;
  type?: string;
};

export type Taxonomy = {
  countries: TaxNode[];
  universities: TaxNode[];
  categories: TaxNode[];
  topics: TaxNode[];
};

const EMPTY: Taxonomy = { countries: [], universities: [], categories: [], topics: [] };

function refId(value: unknown) {
  return (value as DocumentReference | undefined)?.id;
}

function byName(a: TaxNode, b: TaxNode) {
  return a.name.localeCompare(b.name);
}

export function useTaxonomy() {
  const q = useQuery({
    queryKey: ["taxonomy"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Taxonomy> => {
      const db = getDb();
      const [c, u, k, b] = await Promise.all([
        getDocs(collection(db, collections.country)),
        getDocs(collection(db, collections.university)),
        getDocs(collection(db, collections.category)),
        getDocs(collection(db, collections.branch)),
      ]);
      return {
        countries: c.docs
          .map((d) => ({ id: d.id, name: String(d.get("name") || d.id), image: d.get("image") as string | undefined }))
          .sort(byName),
        universities: u.docs
          .map((d) => ({
            id: d.id,
            name: String(d.get("name") || d.id),
            image: d.get("image") as string | undefined,
            countryId: refId(d.get("countryRef")),
            type: (d.get("type") as string | undefined) ?? "university",
          }))
          .sort(byName),
        categories: k.docs
          .map((d) => ({
            id: d.id,
            name: String(d.get("name") || d.id),
            image: d.get("image") as string | undefined,
            universityId: refId(d.get("universityRef")),
            countryId: refId(d.get("countryRef")),
          }))
          .sort(byName),
        topics: b.docs
          .map((d) => ({
            id: d.id,
            name: String(d.get("name") || d.id),
            image: d.get("image") as string | undefined,
            universityId: refId(d.get("universityRef")),
            categoryId: refId(d.get("categoryRef")),
            // Legacy branches store their country as `country`.
            countryId: refId(d.get("country")) ?? refId(d.get("countryRef")),
          }))
          .sort(byName),
      };
    },
  });
  const data = q.data ?? EMPTY;
  const isSchool = (universityId?: string) =>
    Boolean(universityId) && data.universities.find((u) => u.id === universityId)?.type === SCHOOL_TYPE;
  return { ...data, isPending: q.isPending, isSchool };
}

/** Ids picked at each level; empty string means "not chosen / all". */
export type TaxonomySelection = {
  country: string;
  university: string;
  category: string;
  topic: string;
};

export const EMPTY_SELECTION: TaxonomySelection = { country: "", university: "", category: "", topic: "" };

/**
 * Default filter for a signed-in student: their university, plus their field
 * (topic) or grade (category). Falls back to nothing when the profile is thin.
 */
export function selectionFromProfile(
  profile: { countryRef?: DocumentReference; universityRef?: DocumentReference; branchRef?: DocumentReference; categoryRef?: DocumentReference } | null | undefined,
  tax: Taxonomy,
): TaxonomySelection {
  if (!profile) return EMPTY_SELECTION;
  const topic = profile.branchRef?.id ? tax.topics.find((b) => b.id === profile.branchRef?.id) : undefined;
  return {
    country: profile.countryRef?.id ?? "",
    university: profile.universityRef?.id ?? "",
    category: profile.categoryRef?.id ?? topic?.categoryId ?? "",
    topic: profile.branchRef?.id ?? "",
  };
}

/** Options for each level given the levels above it. */
export function optionsFor(tax: Taxonomy, sel: TaxonomySelection) {
  const universities = sel.country ? tax.universities.filter((u) => u.countryId === sel.country) : tax.universities;
  const categories = sel.university
    ? tax.categories.filter((k) => k.universityId === sel.university)
    : sel.country
      ? tax.categories.filter((k) => k.countryId === sel.country || universities.some((u) => u.id === k.universityId))
      : tax.categories;
  const topics = sel.category
    ? tax.topics.filter((b) => b.categoryId === sel.category)
    : sel.university
      ? tax.topics.filter((b) => b.universityId === sel.university)
      : tax.topics;
  return { countries: tax.countries, universities, categories, topics };
}

/** Courses matching every chosen level (unchosen levels match anything). */
export function filterCoursesByTaxonomy<T extends CourseDoc>(courses: T[], sel: TaxonomySelection) {
  return courses.filter(
    (c) =>
      (!sel.country || c.countryRef?.id === sel.country) &&
      (!sel.university || c.universityRef?.id === sel.university) &&
      (!sel.category || c.categoryRef?.id === sel.category) &&
      (!sel.topic || c.branchRef?.id === sel.topic),
  );
}
