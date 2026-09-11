"use client";

import { useEffect, useState } from "react";
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
        <p className="text-[14px] text-white/60">{t("studiesSubtitle")}</p>
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
 * Who this session belongs to, with a way out. Without it a student who signed
 * in with the wrong Google account had no way to tell, and no way to leave.
 */
function SignedInAs() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;
  const providerId = user.providerData[0]?.providerId ?? "";
  const provider =
    providerId === "google.com" ? "Google" : providerId === "apple.com" ? "Apple" : providerId === "password" ? "Email" : "";
  const who = user.email || user.phoneNumber || user.displayName || provider;
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 pt-4 text-[13px] text-white/60">
      <span className="min-w-0 truncate">
        {t("signedInAs")} <span className="text-white/90">{who}</span>
        {provider && who !== provider ? ` · ${provider}` : ""}
      </span>
      <button
        type="button"
        onClick={() => void logout().then(() => router.replace("/login"))}
        className="shrink-0 font-medium text-white underline underline-offset-2"
      >
        {t("notYou")}
      </button>
    </div>
  );
}

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
