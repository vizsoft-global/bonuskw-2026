"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthHeaderLink, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { OtpInput } from "@/components/auth/otp-input";
import { PageLoader } from "@/components/shared/loader";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const last = digits.slice(-4);
  const cc = digits.startsWith("965") ? "+965" : phone.startsWith("+") ? `+${digits.slice(0, digits.length - 8) || "965"}` : "+965";
  return `${cc} •••• ${last}`;
}

function VerifyForm() {
  const { t } = useI18n();
  const { confirmSms, sendSms, sendFallback, confirmFallback, needsOnboarding } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  /** Which sender issued the code being typed; verification must match it. */
  const [channel, setChannel] = useState<"firebase" | "whatsapp" | "sms">("firebase");
  const [notice, setNotice] = useState("");
  const [phone] = useState(
    () => (typeof window !== "undefined" ? window.sessionStorage.getItem("ba_phone") || "" : ""),
  );

  useEffect(() => {
    const id = window.setTimeout(() => setShowFallback(true), 30000);
    return () => window.clearTimeout(id);
  }, []);

  async function done() {
    router.replace(needsOnboarding ? "/onboarding" : "/");
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      if (channel === "firebase") await confirmSms(code);
      else await confirmFallback(phone, code);
      await done();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  async function resend(via: "firebase" | "whatsapp" | "sms") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (via === "firebase") await sendSms(phone);
      else await sendFallback(phone, via);
      setChannel(via);
      setCode("");
      setNotice(t("codeResent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
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
          <AuthHeading>{t("verifyPhone")}</AuthHeading>
          <p className="text-[14px] text-white/60">
            {t("codeSentTo")}
            <br />
            {phone ? maskPhone(phone) : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <OtpInput value={code} onChange={setCode} />
          <button
            type="button"
            disabled={busy}
            className="text-[14px] font-medium text-white underline disabled:opacity-60"
            onClick={() => void resend("firebase")}
          >
            {t("resendCode")}
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          {notice && !error ? <p className="text-sm text-white/70">{notice}</p> : null}
          <CtaButton loading={busy} disabled={busy || code.replace(/\D/g, "").length < 6} onClick={() => void verify()}>
            {t("verifyContinue")}
          </CtaButton>
          {showFallback ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className="text-sm text-white/60 disabled:opacity-60"
                onClick={() => void resend("whatsapp")}
              >
                {t("whatsapp")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="text-sm text-white/40 disabled:opacity-60"
                onClick={() => void resend("sms")}
              >
                {t("smsFallback")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<PageLoader full />}>
      <VerifyForm />
    </Suspense>
  );
}
