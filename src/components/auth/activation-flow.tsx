"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { OtpInput } from "@/components/auth/otp-input";
import { SignedInAs } from "@/components/auth/signed-in-as";
import { SupportLink } from "@/components/auth/support-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/shared/loader";
import { authErrorMessage } from "@/lib/auth/auth-errors";
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

function PhoneStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { sendLinkSms, confirmLinkSms } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneReady = phone.length === 8;
  const codeReady = code.replace(/\D/g, "").length === 6;

  async function send() {
    if (!phoneReady) return;
    setBusy(true);
    setError("");
    try {
      await sendLinkSms(phone);
      setSent(true);
      setCode("");
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const result = await confirmLinkSms(code);
      if (result.switched) {
        // The number already belonged to an account: the code proved ownership,
        // so the session was moved to that account by the provider. Send the
        // student home — the guard re-reads that account's own state, which may
        // itself still owe a step.
        router.replace("/");
        return;
      }
      onDone();
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[25px]">
      {sent ? (
        <>
          <p className="text-[13px] text-muted">
            {t("verifyPhoneBody", { phone: `+965 ${phone}` })}
          </p>
          <OtpInput value={code} onChange={setCode} />
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setSent(false)}>
            {t("changeNumber")}
          </Button>
        </>
      ) : (
        <Field
          phone
          label={t("mobileNumber")}
          value={phone}
          onChange={setPhone}
          placeholder="0000 0000"
          autoComplete="tel-national"
          onSubmit={() => void send()}
        />
      )}
      {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
      <CtaButton
        loading={busy}
        disabled={busy || (sent ? !codeReady : !phoneReady)}
        onClick={() => void (sent ? verify() : send())}
      >
        {sent ? t("verifyCode") : t("sendCode")}
      </CtaButton>
      {sent ? (
        <SupportLink phone={phoneReady ? `+965 ${phone}` : undefined} className="self-start" />
      ) : null}
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
  const finishing = useRef(false);

  // Whatever the account is still missing, in order. A step that is not enforced
  // yet never appears here.
  const step = gate.steps[0];
  const complete = Boolean(user && profile) && !gate.loading && gate.steps.length === 0;

  /**
   * Runs once the last step is done: stamps `verification.activatedAt` (through a
   * dot path, so any fields already in `verification` survive) and releases the
   * student. Driven by the steps being complete rather than by the last step
   * calling it, so a phase that adds a step cannot stamp early.
   */
  useEffect(() => {
    if (!complete || finishing.current) return;
    finishing.current = true;
    void (async () => {
      try {
        if (user) {
          await updateDoc(doc(getDb(), collections.users, user.uid), {
            "verification.activatedAt": new Date(),
          });
          await refreshProfile();
        }
      } catch {
        // The gate releases on the steps being complete, so a failed stamp must
        // not hold the student here.
      }
      onFinished?.();
      router.replace("/");
    })();
  }, [complete, user, refreshProfile, onFinished, router]);

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
          // Each step just refreshes the profile; the flow re-reads what is left
          // and moves on, or finishes.
          <NamesStep onDone={() => void refreshProfile()} />
        ) : step === "phone" ? (
          <PhoneStep onDone={() => void refreshProfile()} />
        ) : (
          // The email step arrives in phase 4.
          <PageLoader />
        )}
      </div>
      <SignedInAs />
    </AuthShell>
  );
}
