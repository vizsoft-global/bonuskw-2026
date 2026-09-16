"use client";

import { useState } from "react";
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

/**
 * The activation flow itself: whatever steps the account is missing, in order.
 *
 * Rendered by the `/activate` route and shown inline by `ActivationGuard`, which
 * is what actually enforces it app-wide — the app has no shared auth wrapper for
 * pages to opt into, so a guard over the layout is the only place that cannot be
 * missed.
 */
export function ActivationFlow({ onFinished }: { onFinished?: () => void }) {
  const { t } = useI18n();
  const { user, profile, ready, refreshProfile } = useAuth();
  const gate = useActivationGate();
  const router = useRouter();

  // Only the steps the flow enforces are asked for; `names` is the first that
  // exists. The email and phone steps join it in the next phases.
  const step = gate.steps[0];

  /**
   * Stamps the profile once nothing is missing, so the admin can tell a finished
   * account from a grandfathered one. Dot paths keep any existing fields in
   * `verification`.
   */
  async function finish() {
    try {
      if (user) {
        await updateDoc(doc(getDb(), collections.users, user.uid), {
          "verification.activatedAt": new Date(),
        });
        await refreshProfile();
      }
    } catch {
      // The gate releases on the steps being complete, so a failed stamp must not
      // hold the student here.
    }
    onFinished?.();
    router.replace("/");
  }

  if (!ready || !profile || !user || gate.loading) {
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
          <NamesStep onDone={() => void finish()} />
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
