"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { OtpInput } from "@/components/auth/otp-input";
import { PageLoader } from "@/components/shared/loader";
import { authErrorMessage } from "@/lib/auth/auth-errors";
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
  const { confirmSms, sendSms, sendFallback, confirmFallback } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Which sender issued the code being typed; verification must match it. */
  const [channel, setChannel] = useState<"firebase" | "whatsapp" | "sms">("firebase");
  const [notice, setNotice] = useState("");
  const [phone] = useState(
    () => (typeof window !== "undefined" ? window.sessionStorage.getItem("ba_phone") || "" : ""),
  );

  async function verify() {
    setBusy(true);
    setError("");
    try {
      // The result carries the fresh profile state, so the redirect never
      // reads a stale `needsOnboarding` from before the sign-in.
      const result = channel === "firebase" ? await confirmSms(code) : await confirmFallback(phone, code);
      router.replace(result.needsOnboarding ? "/onboarding" : "/");
    } catch (err) {
      setError(authErrorMessage(err, t));
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
      setError(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  const ready = code.replace(/\D/g, "").length === 6;

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{t("verifyPhone")}</AuthHeading>
          <p className="text-[14px] text-white/60">
            {t("codeSentTo")}
            <br />
            <span className="font-medium text-white" dir="ltr">
              {phone ? maskPhone(phone) : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <OtpInput value={code} onChange={setCode} />
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          {notice && !error ? <p className="text-sm text-white/70">{notice}</p> : null}
          <CtaButton loading={busy} disabled={busy || !ready} onClick={() => void verify()}>
            {t("verifyContinue")}
          </CtaButton>
        </div>
        <div className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[13px] text-white/60">{t("didntGetCode")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-white/20 px-3.5 py-2 text-[13px] font-medium text-white hover:border-white/40 disabled:opacity-60"
              onClick={() => void resend("firebase")}
            >
              {t("resendFirebase")}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-white/20 px-3.5 py-2 text-[13px] font-medium text-white hover:border-white/40 disabled:opacity-60"
              onClick={() => void resend("whatsapp")}
            >
              {t("sendViaWhatsapp")}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-white/20 px-3.5 py-2 text-[13px] font-medium text-white hover:border-white/40 disabled:opacity-60"
              onClick={() => void resend("sms")}
            >
              {t("sendViaSms")}
            </button>
          </div>
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
