"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { SignedInAs } from "@/components/auth/signed-in-as";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/shared/loader";
import { useActivationGate } from "@/lib/auth/activation";
import { useAuth } from "@/lib/auth/auth-provider";
import { collections } from "@/lib/firebase/collections";
import { getDb } from "@/lib/firebase/client";
import { useI18n } from "@/lib/i18n/locale";

/** Youngest a student can plausibly be; also rejects a slipped digit. */
const MIN_AGE = 10;

function ageFrom(iso: string) {
  const born = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

function NamesStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const age = birthDate ? ageFrom(birthDate) : null;
  const complete =
    Boolean(firstName.trim()) && Boolean(lastName.trim()) && age !== null && age >= MIN_AGE;

  async function save() {
    if (!user || !complete || age === null) return;
    setBusy(true);
    setError("");
    try {
      await updateDoc(doc(getDb(), collections.users, user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`,
        // `dob` predates this flow (the Flutter app writes it), so it is reused
        // rather than adding a second date of birth.
        dob: new Date(`${birthDate}T00:00:00`),
        age,
      });
      await refreshProfile();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <div className="grid gap-1.5">
        <label className="text-[13px] font-medium text-muted">{t("firstName")}</label>
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
      </div>
      <div className="grid gap-1.5">
        <label className="text-[13px] font-medium text-muted">{t("lastName")}</label>
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
      </div>
      <div className="grid gap-1.5">
        <label className="text-[13px] font-medium text-muted">{t("birthDate")}</label>
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        {birthDate && age !== null && age < MIN_AGE ? (
          <p className="text-[12px] text-[#f24822]">{t("birthDateTooYoung")}</p>
        ) : null}
      </div>
      {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
      <CtaButton loading={busy} disabled={busy || !complete} onClick={() => void save()}>
        {t("saveContinue")}
      </CtaButton>
    </div>
  );
}

export default function ActivatePage() {
  const { t } = useI18n();
  const { user, profile, ready } = useAuth();
  const gate = useActivationGate();
  const router = useRouter();

  const done = ready && Boolean(profile) && !gate.needsActivation;
  const signedOut = ready && !user;
  // Only the steps the flow enforces are asked for; `names` is the first one
  // that exists. The email and phone steps join it in the next phases.
  const step = gate.steps[0];

  useEffect(() => {
    if (signedOut) router.replace("/login");
    else if (done) router.replace("/");
  }, [done, router, signedOut]);

  if (!ready || !profile || !user || done || gate.loading) {
    return (
      <AuthShell showBack={false}>
        <PageLoader />
      </AuthShell>
    );
  }

  return (
    <AuthShell showBack={false}>
      <div className="flex flex-col gap-[43px]">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{t("activateTitle")}</AuthHeading>
          <p className="text-[14px] text-muted">{t("activateSubtitle")}</p>
        </div>
        {step === "names" ? (
          <NamesStep onDone={() => router.replace("/")} />
        ) : (
          // Unreachable while only `names` is enforced; a later phase adds the
          // identifier steps here.
          <PageLoader />
        )}
      </div>
      <SignedInAs />
    </AuthShell>
  );
}
