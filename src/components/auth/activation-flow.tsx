"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { PhoneStep } from "@/components/auth/phone-step";
import { SignedInAs } from "@/components/auth/signed-in-as";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/shared/loader";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { useActivationGate } from "@/lib/auth/activation";
import { useAuth } from "@/lib/auth/auth-provider";
import { usePending } from "@/lib/auth/use-pending";
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

function EmailStep() {
  const { t } = useI18n();
  const { user, linkEmail, resendVerificationEmail, refreshProfile, checkIdentifier, logout } =
    useAuth();
  const router = useRouter();
  /** One request at a time; `busy` alone is read too late to stop a double tap. */
  const guard = usePending();
  /**
   * A password signup already carries its address, so it must not be asked for
   * it again — and `updateEmail` cannot move an address onto itself. Seeding
   * from the account (and starting on the "link sent" screen when there is one)
   * is what lets the same step serve both a phone-created account, which has to
   * type an address, and a signup, which only has to open its inbox.
   */
  const existing = user?.email ?? "";
  const [email, setEmail] = useState(existing);
  const [sent, setSent] = useState(Boolean(existing));
  /** Set when the address already belongs to another account. */
  const [taken, setTaken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = /\S+@\S+\.\S+/.test(email);

  /** How the other account signs in, in words. */
  function methodName(methods: string[]) {
    if (methods.includes("google.com")) return "Google";
    if (methods.includes("apple.com")) return "Apple";
    if (methods.includes("phone")) return t("mobileNumber");
    return t("email");
  }

  async function send() {
    if (!ready) return;
    await guard(async () => {
      setBusy(true);
      setError("");
      try {
        const address = email.trim();
        // Submitting the address the account already holds is not a change, it is
        // "send me the link again" — and `updateEmail` would be asked to move the
        // address onto itself, which Firebase refuses.
        if (address === existing) {
          await resendVerificationEmail();
          setSent(true);
          return;
        }
        const check = await checkIdentifier("email", address);
        if (check.state === "taken") {
          // Never claim an address that belongs to someone else's account: the
          // student signs in to that account instead.
          setTaken(methodName(check.methods));
          return;
        }
        await linkEmail(address);
        setSent(true);
      } catch (err) {
        setError(authErrorMessage(err, t));
      } finally {
        setBusy(false);
      }
    });
  }

  async function switchAccount() {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    await guard(async () => {
      setBusy(true);
      setError("");
      try {
        await resendVerificationEmail();
      } catch (err) {
        setError(authErrorMessage(err, t));
      } finally {
        setBusy(false);
      }
    });
  }

  /**
   * The link is usually opened in a mail app, so nothing in this tab knows it
   * happened: re-read the user on a timer and let the flow move on by itself.
   * The button is there for the impatient.
   */
  useEffect(() => {
    if (!sent) return;
    const timer = window.setInterval(() => void refreshProfile(), 5000);
    return () => window.clearInterval(timer);
  }, [sent, refreshProfile]);

  if (taken) {
    return (
      <div className="flex flex-col gap-[25px]">
        <p className="text-[15px] font-medium text-text">{t("emailTakenTitle")}</p>
        <p className="text-[13px] leading-relaxed text-muted">
          {t("emailTakenBody", { method: taken })}
        </p>
        <CtaButton loading={busy} disabled={busy} onClick={() => void switchAccount()}>
          {t("switchAccount")}
        </CtaButton>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setTaken(null)}>
          {t("changeEmail")}
        </Button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-[25px]">
        <p className="text-[13px] leading-relaxed text-muted">
          {t("verifyEmailBody", { email })}
        </p>
        {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
        <CtaButton loading={busy} disabled={busy} onClick={() => void refreshProfile()}>
          {t("iVerified")}
        </CtaButton>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void resend()}>
            {t("resendEmail")}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setSent(false)}>
            {t("changeEmail")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[25px]">
      <Field
        type="email"
        label={t("email")}
        value={email}
        onChange={setEmail}
        placeholder="name@example.com"
        autoComplete="email"
        onSubmit={() => void send()}
      />
      {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
      <CtaButton loading={busy} disabled={busy || !ready} onClick={() => void send()}>
        {t("sendEmailLink")}
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
        ) : step === "email" ? (
          <EmailStep />
        ) : (
          <PageLoader />
        )}
      </div>
      <SignedInAs />
    </AuthShell>
  );
}
