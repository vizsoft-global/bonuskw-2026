"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { PageLoader } from "@/components/shared/loader";
import {
  AcademicFields,
  EMPTY_ACADEMIC,
  academicPatch,
  isAcademicComplete,
  type AcademicValue,
} from "@/components/taxonomy/academic-fields";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { useTaxonomy } from "@/lib/taxonomy/use-taxonomy";

export default function OnboardingPage() {
  const { t } = useI18n();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const tax = useTaxonomy();
  const [value, setValue] = useState<AcademicValue>(EMPTY_ACADEMIC);
  const [busy, setBusy] = useState(false);

  const school = tax.isSchool(value.university);
  const complete = isAcademicComplete(value, school);

  async function save() {
    if (!user || !complete) return;
    setBusy(true);
    try {
      await updateDoc(doc(getDb(), collections.users, user.uid), {
        ...academicPatch(value, tax, school),
        welcomeStatus: true,
      });
      await refreshProfile();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  if (tax.isPending) {
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
          <AcademicFields value={value} onChange={setValue} />
        </div>
        <CtaButton loading={busy} disabled={busy || !complete} onClick={() => void save()}>
          {t("saveContinue")}
        </CtaButton>
      </div>
    </AuthShell>
  );
}
