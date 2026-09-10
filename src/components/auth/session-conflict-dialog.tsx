"use client";

import { formatDistanceToNow } from "date-fns";
import { Loader } from "@/components/shared/loader";
import { useI18n } from "@/lib/i18n/locale";
import type { OtherSession } from "@/lib/auth/session-client";

/**
 * Shown when the account already has an active session on another device.
 * The student is never blocked: they can take over (the other device is signed
 * out) or sign out here and keep the other device.
 */
export function SessionConflictDialog({
  sessions,
  busy,
  onTakeOver,
  onSignOut,
}: {
  sessions: OtherSession[];
  busy: boolean;
  onTakeOver: () => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const anyLive = sessions.some((s) => s.live);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-conflict-title"
      className="fixed inset-0 z-[120] grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-[400px] rounded-[20px] border border-white/10 bg-[#141414] p-5 shadow-2xl">
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-[#ff7a00]/15 text-[#ff7a00]">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
        </div>
        <h2 id="session-conflict-title" className="text-[17px] font-semibold text-[#fafafa]">
          {t("sessionConflictTitle")}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#999]">
          {anyLive ? t("sessionConflictBodyLive") : t("sessionConflictBodyIdle")}
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {sessions.slice(0, 3).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.05] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#fafafa]">{s.label}</p>
                <p className="truncate text-[11px] text-[#999]">
                  {[s.location, s.lastSeenAt ? formatDistanceToNow(new Date(s.lastSeenAt), { addSuffix: true }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span
                className={
                  s.live
                    ? "shrink-0 rounded-full bg-[#1f9d4d]/20 px-2 py-0.5 text-[10px] font-semibold text-[#4ade80]"
                    : "shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#999]"
                }
              >
                {s.live ? t("sessionActiveNow") : t("sessionIdle")}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onTakeOver}
            className="relative flex h-12 w-full items-center justify-center rounded-full bg-[#0c5eff] text-[14px] font-semibold text-white disabled:opacity-70"
          >
            {busy ? <Loader size="inline" /> : t("sessionUseThisDevice")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSignOut}
            className="h-11 w-full rounded-full text-[13px] font-medium text-[#999] hover:text-[#fafafa] disabled:opacity-70"
          >
            {t("sessionKeepOther")}
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-[#666]">{t("sessionConflictHint")}</p>
      </div>
    </div>
  );
}
