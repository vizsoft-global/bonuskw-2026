"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { OtpInput } from "@/components/auth/otp-input";
import { PageLoader } from "@/components/shared/loader";
import { toast } from "@/components/ui/toaster";
import {
  AcademicFields,
  EMPTY_ACADEMIC,
  academicPatch,
  isAcademicComplete,
  type AcademicValue,
} from "@/components/taxonomy/academic-fields";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { useTaxonomy } from "@/lib/taxonomy/use-taxonomy";
import { digitsOnly } from "@/lib/utils";

/**
 * Step 1 (only when the account has no verified phone — Google / Apple / email
 * sign-ins): attach a mobile number with a one-time code.
 */
function PhoneStep() {
  const { t } = useI18n();
  const { sendLinkSms, confirmLinkSms, logout } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);

  function onPhone(raw: string) {
    let d = digitsOnly(raw);
    if (d.startsWith("965") && d.length > 8) d = d.slice(3);
    setPhone(d.replace(/^0+/, "").slice(0, 8));
  }

  async function send() {
    if (phone.length !== 8) {
      setError(t("enterEightDigits"));
      return;
    }
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

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const result = await confirmLinkSms(code);
      if (result.switched) {
        // We moved to the account that owns this number.
        toast.success(t("phoneSwitched"));
        router.replace(result.needsOnboarding ? "/onboarding" : "/");
      }
      // Otherwise the profile now has a phone; the parent re-renders into the next step.
    } catch (err) {
      const codeOf = (err as { code?: string })?.code;
      if (codeOf === "profile/phone-conflict") {
        setConflict(true);
        setError(t("phoneConflict"));
      } else {
        setError(authErrorMessage(err, t));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2.5">
        <AuthHeading>{t("addPhoneTitle")}</AuthHeading>
        <p className="text-[14px] leading-relaxed text-white/60">{t("addPhoneSubtitle")}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Field
          phone
          label={t("mobileNumber")}
          value={phone}
          onChange={(v) => {
            onPhone(v);
            if (sent) setSent(false);
          }}
          placeholder="0000 0000"
          autoComplete="tel-national"
          onSubmit={() => void (sent ? confirm() : send())}
        />
        {sent ? (
          <>
            <p className="text-[13px] text-white/60">
              {t("codeSentTo")} <span dir="ltr">+965 {phone}</span>
            </p>
            <OtpInput value={code} onChange={setCode} />
          </>
        ) : null}
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        {conflict ? (
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="self-start text-[14px] font-medium text-white underline underline-offset-2"
          >
            {t("logout")}
          </button>
        ) : null}
        {sent ? (
          <>
            <CtaButton
              loading={busy}
              disabled={busy || code.replace(/\D/g, "").length !== 6}
              onClick={() => void confirm()}
            >
              {t("verifyAndSave")}
            </CtaButton>
            <div className="flex justify-between text-[13px] text-white/70">
              <button type="button" disabled={busy} onClick={() => void send()} className="hover:text-white">
                {t("resendFirebase")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSent(false);
                  setCode("");
                }}
                className="hover:text-white"
              >
                {t("changeNumber")}
              </button>
            </div>
          </>
        ) : (
          <CtaButton loading={busy} disabled={busy || phone.length !== 8} onClick={() => void send()}>
            {t("continue")}
          </CtaButton>
        )}
      </div>
    </div>
  );
}

/** Step 2: country / university / field. */
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
  const { user, needsPhone, needsOnboarding, ready, profile } = useAuth();
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
      {needsPhone ? <PhoneStep /> : <AcademicStep />}
      <SignedInAs />
    </AuthShell>
  );
}
