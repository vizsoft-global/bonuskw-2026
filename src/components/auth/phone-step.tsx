"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CtaButton } from "@/components/auth/cta-button";
import { Field } from "@/components/auth/field";
import { OtpInput } from "@/components/auth/otp-input";
import { SupportLink } from "@/components/auth/support-link";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { useAuth } from "@/lib/auth/auth-provider";
import { usePending } from "@/lib/auth/use-pending";
import { useWebOtp } from "@/lib/auth/use-web-otp";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Attaches a verified mobile number to the signed-in account.
 *
 * Used by the activation flow and by the profile, because a verified number is
 * required to buy but not to browse: taking it out of `ENFORCED` stops it
 * blocking the app, but it must still be reachable from somewhere or a student
 * who wants to pay has no way to give us a number at all.
 *
 * If the number already belongs to another account, the code proves ownership
 * of it and the provider moves the session to that account instead
 * (`switched: true`), so the caller decides where to send the student.
 */
export function PhoneStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { sendLinkSms, confirmLinkSms } = useAuth();
  const router = useRouter();
  /** One request at a time; `busy` alone is read too late to stop a double tap. */
  const guard = usePending();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneReady = phone.length === 8;
  const codeReady = code.replace(/\D/g, "").length === 6;

  // Offers the code from the SMS while we are waiting for one.
  useWebOtp({ enabled: sent && code.length < 6, onCode: setCode });

  async function send() {
    if (!phoneReady) return;
    await guard(async () => {
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
    });
  }

  async function verify() {
    await guard(async () => {
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
    });
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
