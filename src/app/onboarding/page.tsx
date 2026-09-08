"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { SelectField } from "@/components/auth/field";
import { PageLoader } from "@/components/shared/loader";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

type Option = { id: string; name: string; countryId?: string; universityId?: string };

export default function OnboardingPage() {
  const { t } = useI18n();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [countries, setCountries] = useState<Option[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [fields, setFields] = useState<Option[]>([]);
  const [country, setCountry] = useState("");
  const [university, setUniversity] = useState("");
  const [field, setField] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [c, u, b] = await Promise.all([
          getDocs(collection(getDb(), collections.country)),
          getDocs(collection(getDb(), collections.university)),
          getDocs(collection(getDb(), collections.branch)),
        ]);
        setCountries(c.docs.map((d) => ({ id: d.id, name: String(d.get("name") || d.id) })));
        setUniversities(
          u.docs.map((d) => ({
            id: d.id,
            name: String(d.get("name") || d.id),
            countryId: d.get("countryRef")?.id,
          })),
        );
        setFields(
          b.docs.map((d) => ({
            id: d.id,
            name: String(d.get("name") || d.id),
            universityId: d.get("universityRef")?.id,
          })),
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function save() {
    if (!user || !country || !university || !field) return;
    setBusy(true);
    try {
      await updateDoc(doc(getDb(), collections.users, user.uid), {
        countryRef: doc(getDb(), collections.country, country),
        universityRef: doc(getDb(), collections.university, university),
        branchRef: doc(getDb(), collections.branch, field),
        year_of_study: year || null,
        welcomeStatus: true,
      });
      await refreshProfile();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  const years = [
    { id: "1st Year", name: t("year1") },
    { id: "2nd Year", name: t("year2") },
    { id: "3rd Year", name: t("year3") },
    { id: "Final Year", name: t("yearFinal") },
  ];

  if (!ready) {
    return (
      <AuthShell showBack>
        <PageLoader />
      </AuthShell>
    );
  }

  return (
    <AuthShell showBack>
      <div className="flex flex-col gap-[43px]">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{t("tellUsStudies")}</AuthHeading>
          <p className="text-[14px] text-white/60">{t("studiesSubtitle")}</p>
        </div>
        <div className="flex flex-col gap-[25px]">
          <SelectField
            icon="/onboarding/globe.svg"
            label={t("country")}
            placeholder={t("selectCountry")}
            value={country}
            onChange={(v) => {
              setCountry(v);
              setUniversity("");
              setField("");
            }}
            options={countries}
          />
          <SelectField
            icon="/onboarding/bank.svg"
            label={t("university")}
            placeholder={t("selectUniversity")}
            value={university}
            onChange={(v) => {
              setUniversity(v);
              setField("");
            }}
            options={universities.filter((u) => !country || u.countryId === country)}
          />
          <SelectField
            icon="/onboarding/graduation-hat.svg"
            label={t("field")}
            placeholder={t("selectMajor")}
            value={field}
            onChange={setField}
            options={fields.filter((f) => !university || f.universityId === university)}
          />
          <SelectField
            icon="/onboarding/certificate.svg"
            label={t("year")}
            optional={t("yearOptional")}
            placeholder={t("selectYear")}
            value={year}
            onChange={setYear}
            options={years}
          />
        </div>
        <CtaButton loading={busy} disabled={busy || !country || !university || !field} onClick={() => void save()}>
          {t("saveContinue")}
        </CtaButton>
      </div>
    </AuthShell>
  );
}
