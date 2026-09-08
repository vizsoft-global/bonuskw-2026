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
  const { user } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPassword = Boolean(user?.providerData.some((p) => p.providerId === "password"));

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
          <p className="mt-[15px] text-[12px] text-white/60">{t("passwordHint")}</p>
          {error ? <p className="mt-2 text-[12px] text-[#f24822]">{error}</p> : null}
          <div className="mt-8 pb-4">
            <CtaButton loading={busy} disabled={busy || !next} onClick={() => void save()}>
              {t("updatePassword")}
            </CtaButton>
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-[#999]">{t("phoneAccountPassword")}</p>
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
