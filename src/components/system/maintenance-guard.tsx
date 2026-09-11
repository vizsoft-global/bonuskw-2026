"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { BrandLogo } from "@/components/auth/brand-logo";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import {
  formatRemain,
  hasMaintenanceBypass,
  writeMaintenanceCookie,
  type MaintenanceWindow,
} from "@/lib/maintenance";

export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const [windowState, setWindowState] = useState<MaintenanceWindow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const stop = onSnapshot(doc(getDb(), collections.adminConfig, "studentApp"), (snap) => {
      const raw = (snap.get("maintenance") ?? {}) as MaintenanceWindow;
      setWindowState({
        enabled: raw.enabled === true,
        until: typeof raw.until === "number" ? raw.until : undefined,
      });
    });
    return () => stop();
  }, []);

  useEffect(() => {
    if (!windowState?.enabled) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [windowState?.enabled]);

  if (!windowState) return children;
  const bypass = unlocked || hasMaintenanceBypass(windowState.until);
  if (!windowState.enabled || bypass) return children;

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/maintenance/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "student", password: password.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { until?: number | null };
      if (!res.ok) {
        setError(t("maintenanceWrong"));
        return;
      }
      writeMaintenanceCookie(body.until ?? windowState?.until);
      setUnlocked(true);
    } finally {
      setBusy(false);
    }
  }

  const until = windowState.until;
  const remain = until && until > now ? formatRemain(until, now) : null;

  return (
    <main className="fixed inset-0 z-[90] grid min-h-dvh place-items-center overflow-y-auto bg-[#050505] px-5">
      <div className="flex w-full max-w-[400px] flex-col items-center py-10">
        <BrandLogo size="card" />
        <h1 className="mt-8 text-center text-[22px] font-semibold text-[#fafafa]">{t("maintenanceTitle")}</h1>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-[#999]">{t("maintenanceBody")}</p>
        <p className="mt-6 font-mono text-[40px] font-semibold tabular-nums text-[#fafafa]">{remain ?? t("maintenanceSoon")}</p>
        {until && until > now ? (
          <p className="mt-1 text-center text-[12px] text-[#666]">
            {t("maintenanceUntil", { time: new Date(until).toLocaleString(locale === "ar" ? "ar" : "en") })}
          </p>
        ) : null}
        <label className="mt-8 w-full">
          <span className="text-[12px] text-[#999]">{t("maintenancePassword")}</span>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void unlock();
            }}
            className="mt-1.5 h-11 w-full rounded-[12px] border border-white/15 bg-white/[0.06] px-3 text-[14px] text-[#fafafa] outline-none"
          />
        </label>
        {error ? <p className="mt-2 w-full text-[12px] text-[#f24822]">{error}</p> : null}
        <button
          type="button"
          disabled={busy || !password.trim()}
          onClick={() => void unlock()}
          className="mt-3 h-11 w-full rounded-[12px] bg-[#0c5eff] text-[14px] font-medium text-white disabled:opacity-50"
        >
          {t("maintenanceUnlock")}
        </button>
      </div>
    </main>
  );
}
