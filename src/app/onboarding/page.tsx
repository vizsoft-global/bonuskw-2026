"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { SignedInAs } from "@/components/auth/signed-in-as";
import { PageLoader } from "@/components/shared/loader";
import {
  AcademicFields,
  academicFromProfile,
  academicPatch,
  isAcademicComplete,
  type AcademicValue,
} from "@/components/taxonomy/academic-fields";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { useTaxonomy } from "@/lib/taxonomy/use-taxonomy";

/** How long a taxonomy read may take before the student is offered a retry. */
const TAXONOMY_PATIENCE_MS = 8000;

/**
 * Country / university / field. A phone number is never required here; blocked
 * SMS delivery in Kuwait made that step a wall, and nothing downstream needs it.
 *
 * The form does not wait for the profile document: it needs the signed-in user
 * and the taxonomy only, and a stalled profile read used to leave a full-screen
 * loader here — which is what students described as the app throwing them out
 * right after signing up. Anything the profile does hold is prefilled instead.
 */
function AcademicStep() {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tax = useTaxonomy();
  const [value, setValue] = useState<AcademicValue>(() => academicFromProfile(profile));
  /** Once the student has touched the form, a late profile must not overwrite it. */
  const touched = useRef(false);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!touched.current && profile) setValue(academicFromProfile(profile));
  }, [profile]);

  useEffect(() => {
    if (!tax.isPending || tax.isError) return;
    const timer = window.setTimeout(() => setSlow(true), TAXONOMY_PATIENCE_MS);
    return () => window.clearTimeout(timer);
  }, [tax.isPending, tax.isError]);

  const school = tax.isSchool(value.university);
  const complete = isAcademicComplete(value, school);

  function change(next: AcademicValue) {
    touched.current = true;
    setValue(next);
  }

  async function save() {
    if (!user || !complete) return;
    setBusy(true);
    setError("");
    try {
      await updateDoc(doc(getDb(), collections.users, user.uid), {
        ...academicPatch(value, tax, school),
        welcomeStatus: true,
      });
      await refreshProfile();
      router.replace("/");
    } catch {
      // This used to be an unhandled rejection: the button looked dead and the
      // student had no idea whether anything was saved.
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (tax.isError || (slow && tax.isPending)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] leading-relaxed text-muted">{t("loadFailed")}</p>
        <CtaButton
          onClick={() => {
            setSlow(false);
            void queryClient.invalidateQueries({ queryKey: ["taxonomy"] });
          }}
        >
          {t("retry")}
        </CtaButton>
      </div>
    );
  }

  if (tax.isPending) return <PageLoader />;

  return (
    <div className="flex flex-col gap-[43px]">
      <div className="flex flex-col gap-2.5">
        <AuthHeading>{t("tellUsStudies")}</AuthHeading>
        <p className="text-[14px] text-muted">{t("studiesSubtitle")}</p>
      </div>
      <div className="flex flex-col gap-[25px]">
        <AcademicFields value={value} onChange={change} />
        {error ? <p className="text-[13px] text-accent">{error}</p> : null}
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

  if (!ready || signedOut || done) {
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
