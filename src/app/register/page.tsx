"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthHeaderLink,
  AuthHeading,
  AuthShell,
} from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { LegalNote } from "@/components/auth/legal-note";
import { SocialButton } from "@/components/auth/social-button";
import { PageLoader } from "@/components/shared/loader";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { useAuth, type SignInResult } from "@/lib/auth/auth-provider";
import { usePending } from "@/lib/auth/use-pending";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Creating an account, which is the one thing the app never had: a phone
 * number used to be the only way in, so a student proved it with a code and
 * the account appeared behind them. An email and a password replaces that,
 * and the verification link is sent but never enforced — a mistyped address is
 * the student's to fix, and it is checked again at `/activate` where a resend
 * is one tap away.
 */
function RegisterForm() {
  const { t } = useI18n();
  const { signUpEmail, signInGoogle, signInApple } = useAuth();
  const router = useRouter();
  /** One request at a time; `busy` alone is read too late to stop a double tap. */
  const guard = usePending();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailReady = /\S+@\S+\.\S+/.test(email);
  const passwordReady = password.length >= 6;
  const matches = confirm === password;
  const ready = emailReady && passwordReady && matches;

  function landing(result: SignInResult) {
    router.replace(result.needsOnboarding ? "/onboarding" : "/");
  }

  async function submit() {
    if (!ready) return;
    await guard(async () => {
      setBusy(true);
      setError("");
      try {
        landing(await signUpEmail(email, password));
      } catch (err) {
        setError(authErrorMessage(err, t));
      } finally {
        setBusy(false);
      }
    });
  }

  /**
   * Google and Apple stay available from here as well as from `/login`: a
   * student who lands on the wrong screen should never have to work out which
   * one holds the button they want. Signing up with either is idempotent — an
   * existing account simply signs in.
   */
  async function social(fn: () => Promise<SignInResult>) {
    await guard(async () => {
      setBusy(true);
      setError("");
      try {
        landing(await fn());
      } catch (err) {
        setError(authErrorMessage(err, t));
      } finally {
        setBusy(false);
      }
    });
  }

  const toggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="shrink-0 text-[13px] font-medium text-muted hover:text-text"
    >
      {showPassword ? t("hidePassword") : t("showPassword")}
    </button>
  );

  return (
    <AuthShell showBack={false}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{t("createAccount")}</AuthHeading>
          <p className="text-[14px] leading-relaxed text-muted">{t("signupSubtitle")}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Field
            type="email"
            label={t("emailAddress")}
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
            autoComplete="email"
          />
          <Field
            type={showPassword ? "text" : "password"}
            label={t("password")}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="new-password"
            trailing={toggle}
          />
          <Field
            type={showPassword ? "text" : "password"}
            label={t("signupConfirmPassword")}
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
            autoComplete="new-password"
            onSubmit={() => void submit()}
          />
          {/* Only speak up once there is something to complain about, and only
              about the field that is actually wrong. */}
          {password && !passwordReady ? (
            <p className="text-[13px] text-accent">{t("passwordTooShort")}</p>
          ) : null}
          {confirm && !matches ? (
            <p className="text-[13px] text-accent">{t("passwordMismatch")}</p>
          ) : null}
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <CtaButton loading={busy} disabled={busy || !ready} onClick={() => void submit()}>
            {t("continue")}
          </CtaButton>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-[12px] uppercase tracking-wide text-faint">
            <span className="h-px flex-1 bg-surface" />
            <span>{t("orContinueWith")}</span>
            <span className="h-px flex-1 bg-surface" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <SocialButton
              icon="/onboarding/google.svg"
              disabled={busy}
              onClick={() => void social(signInGoogle)}
            >
              Google
            </SocialButton>
            <SocialButton
              icon="/onboarding/apple.svg"
              disabled={busy}
              onClick={() => void social(signInApple)}
            >
              Apple
            </SocialButton>
          </div>
        </div>

        <AuthHeaderLink prefix={t("haveAccountLogin")} action={t("logInLink")} href="/login" />
        <LegalNote />
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoader full />}>
      <RegisterForm />
    </Suspense>
  );
}
