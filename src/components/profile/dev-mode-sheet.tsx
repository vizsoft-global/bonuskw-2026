"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

export function DevModeSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, refreshProfile, profile } = useAuth();
  const { t } = useI18n();
  const unlocked = profile?.devTester === true;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError("");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/dev-mode", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (!res.ok) {
        setError(body.code === "dev-mode-off" ? t("devModeOff") : t("devModeWrong"));
        return;
      }
      await refreshProfile();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function exit() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/dev-mode", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      await refreshProfile();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end p-0 sm:place-items-center sm:p-4">
      <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full rounded-t-[24px] bg-[#141414] px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 sm:max-w-[400px] sm:rounded-[20px] sm:pb-5">
        <div className="mx-auto mb-4 h-0.5 w-[30px] rounded-full bg-white/30 sm:hidden" />
        <p className="text-[16px] font-semibold text-[#fafafa]">{t("devModeTitle")}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#999]">{t("devModeBody")}</p>
        {unlocked ? (
          <p className="mt-3 rounded-[10px] bg-[#f5d08a]/10 px-3 py-2 text-[12px] text-[#f5d08a]">{t("devModeActive")}</p>
        ) : (
          <label className="mt-4 block">
            <span className="text-[12px] text-[#999]">{t("devModePassword")}</span>
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              className="mt-1.5 h-11 w-full rounded-[12px] border border-white/15 bg-black/30 px-3 text-[14px] text-[#fafafa] outline-none"
            />
          </label>
        )}
        {error ? <p className="mt-2 text-[12px] text-[#f24822]">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          {unlocked ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void exit()}
              className="h-11 flex-1 rounded-[12px] bg-[#373737] text-[14px] font-medium text-[#fafafa] disabled:opacity-60"
            >
              {t("devModeExit")}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || password.trim().length < 1}
              onClick={() => void submit()}
              className="h-11 flex-1 rounded-[12px] bg-[#0c5eff] text-[14px] font-medium text-white disabled:opacity-60"
            >
              {t("devModeUnlock")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
