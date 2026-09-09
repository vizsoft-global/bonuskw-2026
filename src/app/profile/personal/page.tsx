"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { CtaButton } from "@/components/auth/cta-button";
import { SelectField } from "@/components/auth/field";
import { Avatar } from "@/components/layout/avatar";
import { ProfileField, ProfileTabs, SectionLabel } from "@/components/profile/ui";
import { ProfilePane } from "@/components/profile/pane";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

type Option = { id: string; name: string; countryId?: string; universityId?: string };

function splitLocation(location?: string) {
  if (!location) return { city: "", country: "" };
  const idx = location.lastIndexOf(",");
  if (idx === -1) return { city: location.trim(), country: "" };
  return { city: location.slice(0, idx).trim(), country: location.slice(idx + 1).trim() };
}

export default function PersonalPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<"personal" | "academic">("personal");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryText, setCountryText] = useState("");
  const [city, setCity] = useState("");
  const [countries, setCountries] = useState<Option[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [fields, setFields] = useState<Option[]>([]);
  const [country, setCountry] = useState("");
  const [university, setUniversity] = useState("");
  const [field, setField] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name || "");
    setEmail(profile.email || "");
    const loc = splitLocation(profile.location);
    setCity(loc.city);
    setCountryText(loc.country);
    setCountry(profile.countryRef?.id || "");
    setUniversity(profile.universityRef?.id || "");
    setField(profile.branchRef?.id || "");
    setYear(profile.year_of_study || "");
  }, [profile]);

  useEffect(() => {
    void (async () => {
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
    })();
  }, []);

  const years = [
    { id: "1st Year", name: t("year1") },
    { id: "2nd Year", name: t("year2") },
    { id: "3rd Year", name: t("year3") },
    { id: "Final Year", name: t("yearFinal") },
  ];

  async function savePersonal() {
    if (!user) return;
    setBusy(true);
    try {
      const location = [city, countryText].map((part) => part.trim()).filter(Boolean).join(", ");
      await updateDoc(doc(getDb(), collections.users, user.uid), {
        display_name: name,
        email,
        location,
      });
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  async function saveAcademic() {
    if (!user || !country || !university || !field) return;
    setBusy(true);
    try {
      await updateDoc(doc(getDb(), collections.users, user.uid), {
        countryRef: doc(getDb(), collections.country, country),
        universityRef: doc(getDb(), collections.university, university),
        branchRef: doc(getDb(), collections.branch, field),
        year_of_study: year || null,
      });
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProfilePane title={t("personal")}>
      <ProfileTabs
        tabs={[
          { id: "personal", label: t("personalDetails") },
          { id: "academic", label: t("academicDetails") },
        ]}
        value={tab}
        onChange={(id) => setTab(id as "personal" | "academic")}
      />

      {tab === "personal" ? (
        <div className="flex flex-col">
          <div className="flex justify-center py-5">
            <Avatar src={profile?.photo_url} name={name || profile?.display_name} className="size-[75px] text-2xl" />
          </div>
          <SectionLabel>{t("basicDetails")}</SectionLabel>
          <div className="mt-[15px] flex flex-col gap-[15px]">
            <ProfileField label={t("fullName")} value={name} onChange={setName} placeholder={t("enterName")} />
            <ProfileField label={t("mobileNumber")} value={profile?.phone_number || ""} readOnly />
            <ProfileField label={t("emailAddress")} value={email} onChange={setEmail} placeholder={t("enterEmail")} />
          </div>
          <div className="mt-8">
            <SectionLabel>{t("locationSection")}</SectionLabel>
            <div className="mt-[15px] flex flex-col gap-[15px]">
              <ProfileField label={t("country")} value={countryText} onChange={setCountryText} placeholder={t("enterCountry")} />
              <ProfileField label={t("city")} value={city} onChange={setCity} placeholder={t("enterCity")} />
            </div>
          </div>
          <div className="mt-8 pb-4">
            <CtaButton loading={busy} disabled={busy} onClick={() => void savePersonal()}>
              {t("saveChanges")}
            </CtaButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="mt-4">
            <SectionLabel>{t("academicInfo")}</SectionLabel>
          </div>
          <div className="mt-[15px] flex flex-col gap-[25px]">
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
          <div className="mt-8 pb-4">
            <CtaButton
              loading={busy}
              disabled={busy || !country || !university || !field}
              onClick={() => void saveAcademic()}
            >
              {t("saveChanges")}
            </CtaButton>
          </div>
        </div>
      )}
    </ProfilePane>
  );
}
