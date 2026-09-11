"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { CtaButton } from "@/components/auth/cta-button";
import {
  AcademicFields,
  EMPTY_ACADEMIC,
  academicFromProfile,
  academicPatch,
  isAcademicComplete,
  type AcademicValue,
} from "@/components/taxonomy/academic-fields";
import { Avatar } from "@/components/layout/avatar";
import { ProfileField, ProfileTabs, SectionLabel } from "@/components/profile/ui";
import { ProfilePane } from "@/components/profile/pane";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { avatarSrc } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n/locale";
import { useTaxonomy } from "@/lib/taxonomy/use-taxonomy";

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
  const [academic, setAcademic] = useState<AcademicValue>(EMPTY_ACADEMIC);
  const [busy, setBusy] = useState(false);
  const tax = useTaxonomy();
  const school = tax.isSchool(academic.university);
  const academicComplete = isAcademicComplete(academic, school);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name || "");
    setEmail(profile.email || "");
    const loc = splitLocation(profile.location);
    setCity(loc.city);
    setCountryText(loc.country);
    setAcademic(academicFromProfile(profile));
  }, [profile]);

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
    if (!user || !academicComplete) return;
    setBusy(true);
    try {
      await updateDoc(doc(getDb(), collections.users, user.uid), academicPatch(academic, tax, school));
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
            <Avatar src={avatarSrc(profile, user?.uid)} name={name || profile?.display_name} className="size-[75px] text-2xl" />
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
            <AcademicFields value={academic} onChange={setAcademic} />
          </div>
          <div className="mt-8 pb-4">
            <CtaButton
              loading={busy}
              disabled={busy || !academicComplete}
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
