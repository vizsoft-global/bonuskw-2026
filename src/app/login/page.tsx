"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthHeaderLink, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { LegalNote } from "@/components/auth/legal-note";
import { SocialButton } from "@/components/auth/social-button";
import { PageLoader } from "@/components/shared/loader";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { digitsOnly } from "@/lib/utils";

function LoginForm() {
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";
  const { t } = useI18n();
  const { sendSms, signInGoogle, signInApple } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onPhone(raw: string) {
    let d = digitsOnly(raw);
    if (d.startsWith("965")) d = d.slice(3);
    setPhone(d.slice(0, 8));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await sendSms(phone);
      router.push(`/verify?mode=${mode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send SMS");
    } finally {
      setBusy(false);
    }
  }

  async function social(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      headerLink={
        mode === "signup" ? (
          <AuthHeaderLink prefix={t("haveAccountLogin")} action={t("logInLink")} href="/login" />
        ) : (
          <AuthHeaderLink
            prefix={t("noAccountSignup")}
            action={t("signupLink")}
            href="/login?mode=signup"
          />
        )
      }
    >
      <div className="flex flex-col gap-[43px]">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{mode === "signup" ? t("createAccount") : t("welcomeBack")}</AuthHeading>
          <p className="text-[14px] text-white/60">
            {mode === "signup" ? t("joinSubtitle") : t("phoneHint")}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <Field
            phone
            label={t("mobileNumber")}
            value={phone}
            onChange={onPhone}
            placeholder="0000 0000"
            autoComplete="tel"
          />
          <SocialButton
            icon="/onboarding/google.svg"
            disabled={busy}
            onClick={() => void social(signInGoogle)}
          >
            {t("google")}
          </SocialButton>
          <SocialButton
            icon="/onboarding/apple.svg"
            disabled={busy}
            onClick={() => void social(signInApple)}
          >
            {t("apple")}
          </SocialButton>
        </div>
        <div className="flex flex-col gap-2.5">
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <CtaButton loading={busy} disabled={busy} onClick={() => void submit()}>
            {t("continue")}
          </CtaButton>
          <LegalNote />
        </div>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader full />}>
      <LoginForm />
    </Suspense>
  );
}
