"use client";

import { deleteField, doc } from "firebase/firestore";
import { SelectField } from "@/components/auth/field";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import { useTaxonomy, type Taxonomy } from "@/lib/taxonomy/use-taxonomy";
import type { UserDoc } from "@/lib/types/firestore";

/** What a student picks about their studies. `grade` is a category id (schools only). */
export type AcademicValue = {
  country: string;
  university: string;
  /** Branch id for universities. */
  field: string;
  /** Category id for high schools. */
  grade: string;
  year: string;
};

export const EMPTY_ACADEMIC: AcademicValue = { country: "", university: "", field: "", grade: "", year: "" };

export function academicFromProfile(profile?: UserDoc | null): AcademicValue {
  return {
    country: profile?.countryRef?.id ?? "",
    university: profile?.universityRef?.id ?? "",
    field: profile?.branchRef?.id ?? "",
    grade: profile?.categoryRef?.id ?? "",
    year: profile?.year_of_study ?? "",
  };
}

export function isAcademicComplete(value: AcademicValue, isSchool: boolean) {
  return Boolean(value.country && value.university && (isSchool ? value.grade : value.field));
}

/** Firestore patch for the user document. Clears whichever of field/grade does not apply. */
export function academicPatch(value: AcademicValue, tax: Taxonomy, isSchool: boolean) {
  const db = getDb();
  const topic = !isSchool && value.field ? tax.topics.find((b) => b.id === value.field) : undefined;
  return {
    countryRef: doc(db, collections.country, value.country),
    universityRef: doc(db, collections.university, value.university),
    branchRef: !isSchool && value.field ? doc(db, collections.branch, value.field) : deleteField(),
    // Universities: keep the topic's category alongside so filters can use either.
    categoryRef: isSchool
      ? doc(db, collections.category, value.grade)
      : topic?.categoryId
        ? doc(db, collections.category, topic.categoryId)
        : deleteField(),
    year_of_study: isSchool ? deleteField() : value.year || null,
  };
}

/**
 * Country → University → Field of study (or Grade for a high school) → Year.
 * Shared by onboarding and the profile's academic tab.
 */
export function AcademicFields({
  value,
  onChange,
}: {
  value: AcademicValue;
  onChange: (value: AcademicValue) => void;
}) {
  const { t } = useI18n();
  const tax = useTaxonomy();
  const school = tax.isSchool(value.university);

  const universities = tax.universities.filter((u) => !value.country || u.countryId === value.country);
  const fields = tax.topics.filter((b) => !value.university || b.universityId === value.university);
  const grades = tax.categories.filter((k) => k.universityId === value.university);
  const years = [
    { id: "1st Year", name: t("year1") },
    { id: "2nd Year", name: t("year2") },
    { id: "3rd Year", name: t("year3") },
    { id: "Final Year", name: t("yearFinal") },
  ];

  return (
    <>
      <SelectField
        icon="/onboarding/globe.svg"
        label={t("country")}
        placeholder={t("selectCountry")}
        value={value.country}
        onChange={(country) => onChange({ ...value, country, university: "", field: "", grade: "" })}
        options={tax.countries}
      />
      <SelectField
        icon="/onboarding/bank.svg"
        label={t("university")}
        placeholder={t("selectUniversity")}
        value={value.university}
        onChange={(university) => onChange({ ...value, university, field: "", grade: "" })}
        options={universities.map((u) => (u.type === "school" ? { id: u.id, name: `${u.name} · ${t("highSchool")}` } : u))}
      />
      {school ? (
        <SelectField
          icon="/onboarding/graduation-hat.svg"
          label={t("grade")}
          placeholder={t("selectGrade")}
          value={value.grade}
          onChange={(grade) => onChange({ ...value, grade })}
          options={grades}
        />
      ) : (
        <>
          <SelectField
            icon="/onboarding/graduation-hat.svg"
            label={t("field")}
            placeholder={t("selectMajor")}
            value={value.field}
            onChange={(field) => onChange({ ...value, field })}
            options={fields}
          />
          <SelectField
            icon="/onboarding/certificate.svg"
            label={t("year")}
            optional={t("yearOptional")}
            placeholder={t("selectYear")}
            value={value.year}
            onChange={(year) => onChange({ ...value, year })}
            options={years}
          />
        </>
      )}
    </>
  );
}
