"use client";

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { CtaButton } from "@/components/auth/cta-button";
import { HomeIcon } from "@/components/home/icon";
import { ProfilePane } from "@/components/profile/pane";
import { ProfileField, SectionLabel } from "@/components/profile/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

export default function PasswordPage() {
  const { user, resetPassword } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Google / Apple / phone accounts have no password until they set one. */
  const [sendBusy, setSendBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const hasPassword = Boolean(user?.providerData.some((p) => p.providerId === "password"));

  /**
   * Setting a password for an account that signs in with Google, Apple or a
   * phone code. Firebase will not attach one without the student proving they
   * own the address, so the only honest button is "mail me a link".
   */
  async function emailReset() {
    const address = user?.email;
    if (!address) return;
    setSendBusy(true);
    setError("");
    try {
      await resetPassword(address);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("passwordHint"));
    } finally {
      setSendBusy(false);
    }
  }

  async function save() {
    if (!user) return;
    setError("");
    if (next.length < 8) {
      setError(t("passwordHint"));
      return;
    }
    if (next !== confirm) {
      setError(t("passwordHint"));
      return;
    }
    setBusy(true);
    try {
      const email = user.email;
      if (email && current) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, current));
      }
      await updatePassword(user, next);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("passwordHint"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProfilePane title={t("changePassword")}>
      {hasPassword ? (
        <div className="flex flex-col">
          <SectionLabel>{t("security")}</SectionLabel>
          <div className="mt-[15px] flex flex-col gap-[15px]">
            <ProfileField
              label={t("currentPassword")}
              value={current}
              onChange={setCurrent}
              placeholder={t("enterCurrentPassword")}
              type={show.current ? "text" : "password"}
              trailing={<Eye on={show.current} onToggle={() => setShow((s) => ({ ...s, current: !s.current }))} />}
            />
            <ProfileField
              label={t("newPassword")}
              value={next}
              onChange={setNext}
              placeholder={t("enterNewPassword")}
              type={show.next ? "text" : "password"}
              trailing={<Eye on={show.next} onToggle={() => setShow((s) => ({ ...s, next: !s.next }))} />}
            />
            <ProfileField
              label={t("confirmPassword")}
              value={confirm}
              onChange={setConfirm}
              placeholder={t("enterNewPassword")}
              type={show.confirm ? "text" : "password"}
              trailing={<Eye on={show.confirm} onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} />}
            />
          </div>
          <p className="mt-[15px] text-[12px] text-muted">{t("passwordHint")}</p>
          {error ? <p className="mt-2 text-[12px] text-[#f24822]">{error}</p> : null}
          <div className="mt-8 pb-4">
            <CtaButton loading={busy} disabled={busy || !next} onClick={() => void save()}>
              {t("updatePassword")}
            </CtaButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <SectionLabel>{t("security")}</SectionLabel>
          <p className="mt-[15px] text-[14px] leading-relaxed text-muted">{t("noPasswordYet")}</p>
          {sent ? (
            <p className="mt-3 text-[12px] text-[#39c07a]">{t("resetEmailSent")}</p>
          ) : null}
          {error ? <p className="mt-2 text-[12px] text-[#f24822]">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-3 pb-4">
            {user?.email ? (
              <CtaButton
                loading={sendBusy}
                disabled={sendBusy || sent}
                onClick={() => void emailReset()}
              >
                {t("emailMePasswordLink")}
              </CtaButton>
            ) : (
              <p className="text-[12px] text-muted">{t("addEmailFirst")}</p>
            )}
          </div>
        </div>
      )}
    </ProfilePane>
  );
}

function Eye({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="size-3.5 shrink-0">
      <HomeIcon src={on ? "/profile/eye.svg" : "/profile/eye-off.svg"} />
    </button>
  );
}
