"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { SignedInAs } from "@/components/auth/signed-in-as";
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

/** Country / university / field. A phone number is never required here; blocked
 * SMS delivery in Kuwait made that step a wall, and nothing downstream needs it. */
function AcademicStep() {
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

  if (tax.isPending) return <PageLoader />;

  return (
    <div className="flex flex-col gap-[43px]">
      <div className="flex flex-col gap-2.5">
        <AuthHeading>{t("tellUsStudies")}</AuthHeading>
        <p className="text-[14px] text-muted">{t("studiesSubtitle")}</p>
      </div>
      <div className="flex flex-col gap-[25px]">
        <AcademicFields value={value} onChange={setValue} />
      </div>
      <CtaButton loading={busy} disabled={busy || !complete} onClick={() => void save()}>
        {t("saveContinue")}
      </CtaButton>
    </div>
  );
}

/**
 * Who this session belongs to, with a way out — see
 * `components/auth/signed-in-as` (shared with the activation screen).
 */
export default function OnboardingPage() {
  const { user, needsOnboarding, ready, profile } = useAuth();
  const router = useRouter();
  const done = ready && Boolean(profile) && !needsOnboarding;
  const signedOut = ready && !user;

  useEffect(() => {
    if (signedOut) router.replace("/login");
    else if (done) router.replace("/");
  }, [done, router, signedOut]);

  if (!ready || !profile || done) {
    return (
      <AuthShell showBack={false}>
        <PageLoader />
      </AuthShell>
    );
  }

  return (
    <AuthShell showBack={false}>
      <AcademicStep />
      <SignedInAs />
    </AuthShell>
  );
}
