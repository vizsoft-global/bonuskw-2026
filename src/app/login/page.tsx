"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { AuthHeaderLink, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { LegalNote } from "@/components/auth/legal-note";
import { SocialButton } from "@/components/auth/social-button";
import { PageLoader } from "@/components/shared/loader";
import { SupportLink } from "@/components/auth/support-link";
import { authErrorKey, authErrorMessage, type AuthErrorKey } from "@/lib/auth/auth-errors";
import { useAuth, type SignInResult } from "@/lib/auth/auth-provider";
import { usePending } from "@/lib/auth/use-pending";
import { useI18n } from "@/lib/i18n/locale";
import { digitsOnly } from "@/lib/utils";

type Mode = "phone" | "email";

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[12px] uppercase tracking-wide text-faint">
      <span className="h-px flex-1 bg-surface" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-surface" />
    </div>
  );
}

/**
 * One entry point for everyone. A phone number either signs an existing
 * student in or creates the account; Google / Apple do the same by identity;
 * email + password is there for accounts made in the previous app.
 */
function LoginForm() {
  const { t } = useI18n();
  const { sendSms, signInGoogle, signInApple, signInEmail, resetPassword } = useAuth();
  const router = useRouter();
  /** One request at a time; `busy` alone is read too late to stop a double tap. */
  const guard = usePending();
  const [mode, setMode] = useState<Mode>("email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  /** The raw failure, so the screen can say more than one generic sentence. */
  const [errKey, setErrKey] = useState<AuthErrorKey | "">("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const phoneReady = phone.length === 8;
  const emailReady = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  function onPhone(raw: string) {
    let d = digitsOnly(raw);
    if (d.startsWith("965") && d.length > 8) d = d.slice(3);
    setPhone(d.replace(/^0+/, "").slice(0, 8));
  }

  function landing(result: SignInResult) {
    router.replace(result.needsOnboarding ? "/onboarding" : "/");
  }

  /**
   * Every failure lands here, so the screen can branch on the code. A wrong
   * password is also what a Google or Apple account produces until it has one,
   * which is why that case gets an extra sentence instead of a dead end.
   */
  function fail(err: unknown) {
    setErrKey(authErrorKey(err));
    setError(authErrorMessage(err, t));
  }

  async function submitPhone() {
    if (!phoneReady) {
      setError(t("enterEightDigits"));
      return;
    }
    await guard(async () => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await sendSms(phone);
        router.push("/verify");
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    });
  }

  async function submitEmail() {
    if (!emailReady) return;
    await guard(async () => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        landing(await signInEmail(email, password));
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    });
  }

  async function forgot() {
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t("authErrInvalidEmail"));
      return;
    }
    await guard(async () => {
      setBusy(true);
      setError("");
      try {
        await resetPassword(email);
        setNotice(t("resetEmailSent"));
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    });
  }

  async function social(fn: () => Promise<SignInResult>) {
    await guard(async () => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        landing(await fn());
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <AuthShell showBack={false}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{mode === "phone" ? t("signInOrCreate") : t("emailSignInTitle")}</AuthHeading>
          <p className="text-[14px] leading-relaxed text-muted">
            {mode === "phone" ? t("signInSubtitle") : t("emailSignInSubtitle")}
          </p>
        </div>

        {mode === "phone" ? (
          <div className="flex flex-col gap-3">
            <Field
              phone
              label={t("mobileNumber")}
              value={phone}
              onChange={onPhone}
              placeholder="0000 0000"
              autoComplete="tel-national"
              onSubmit={() => void submitPhone()}
            />
            {error ? <p className="text-sm text-accent">{error}</p> : null}
            <CtaButton loading={busy} disabled={busy || !phoneReady} onClick={() => void submitPhone()}>
              {t("continue")}
            </CtaButton>
            {error ? (
              <div className="flex flex-col gap-2 pt-1">
                <p className="text-[13px] text-muted">{t("noSmsHint")}</p>
                <SupportLink phone={phoneReady ? `+965 ${phone}` : undefined} className="self-start" />
              </div>
            ) : null}
          </div>
        ) : (
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
              autoComplete="current-password"
              onSubmit={() => void submitEmail()}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-[13px] font-medium text-muted hover:text-text"
                >
                  {showPassword ? t("hidePassword") : t("showPassword")}
                </button>
              }
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void forgot()}
                className="text-[13px] font-medium text-muted underline-offset-2 hover:text-text hover:underline disabled:opacity-60"
              >
                {t("forgotPassword")}
              </button>
            </div>
            {error ? <p className="text-sm text-accent">{error}</p> : null}
            {/* A Google or Apple account has an address but no password, so the
                only thing between that student and their account is not knowing
                that Forgot password is how you set one. */}
            {error && (errKey === "authErrWrongPassword" || errKey === "authErrOtherProvider") ? (
              <p className="text-[13px] leading-relaxed text-muted">{t("socialAccountHint")}</p>
            ) : null}
            {notice && !error ? <p className="text-sm text-muted">{notice}</p> : null}
            <CtaButton loading={busy} disabled={busy || !emailReady} onClick={() => void submitEmail()}>
              {t("continue")}
            </CtaButton>
            <button
              type="button"
              onClick={() => {
                setMode("phone");
                setError("");
                setNotice("");
              }}
              className="py-1 text-[14px] font-medium text-muted hover:text-text"
            >
              {t("useMobileInstead")}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Divider label={t("orContinueWith")} />
          <div className="grid grid-cols-2 gap-2.5">
            <SocialButton icon="/onboarding/google.svg" disabled={busy} onClick={() => void social(signInGoogle)}>
              Google
            </SocialButton>
            <SocialButton icon="/onboarding/apple.svg" disabled={busy} onClick={() => void social(signInApple)}>
              Apple
            </SocialButton>
          </div>
          {mode === "phone" ? (
            <SocialButton
              iconNode={<Mail className="size-5 text-text" strokeWidth={1.8} />}
              disabled={busy}
              onClick={() => {
                setMode("email");
                setError("");
                setNotice("");
              }}
            >
              {t("continueWithEmail")}
            </SocialButton>
          ) : null}
        </div>

        <AuthHeaderLink prefix={t("noAccountSignup")} action={t("signupLink")} href="/register" />
        <LegalNote />
        <Link
          href="/logout"
          title={t("signOutEverywhereHint")}
          className="-mt-4 self-start text-[12px] font-medium text-muted underline underline-offset-2 hover:text-text"
        >
          {t("signOutEverywhere")}
        </Link>
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
