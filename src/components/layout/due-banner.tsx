"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { daysUntil, dueAt, isOverdue, useOutstandingDues } from "@/lib/dues/outstanding";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

/** How far ahead of the due date the notice appears. */
const LEAD_DAYS = 3;

/**
 * Dismissal lasts the browser session, not forever.
 *
 * The notice exists because money is owed; letting it be hidden permanently
 * would defeat the point, so it returns on the next visit and stays until the
 * tranche is settled.
 */
const DISMISS_KEY = "ba_due_notice_dismissed";

/**
 * A standing notice that something is about to fall due, or already has.
 *
 * It sits above the page content on every screen rather than only on the
 * installments page, because the student who needs it is the one who is not
 * looking for it. It appears three days before the due date and does not go away
 * when the date passes — overdue money is the case this matters most for.
 */
export function DueBanner() {
  const { t, locale } = useI18n();
  const { data, signedIn } = useOutstandingDues();
  // Read once on mount through the initialiser rather than in an effect: this
  // renders nothing on the server (there is no data yet), so the first client
  // render and the server render agree.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const shown = useMemo(() => {
    const rows = (data ?? []).filter((due) => {
      const at = dueAt(due);
      return at ? daysUntil(at) <= LEAD_DAYS : false;
    });
    return rows.sort(
      (a, b) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0),
    );
  }, [data]);

  if (!signedIn || dismissed || shown.length === 0) return null;

  const earliest = dueAt(shown[0]!)!;
  const total = shown.reduce((sum, due) => sum + (Number(due.get("amount")) || 0), 0);
  const anyOverdue = shown.some(isOverdue);
  const date = earliest.toLocaleDateString(locale === "ar" ? "ar-KW" : "en-GB", {
    day: "numeric",
    month: "short",
  });
  const text = anyOverdue
    ? t("dueBannerOverdue", { amount: formatKwdLocale(total, locale), date })
    : t("dueBannerDue", { amount: formatKwdLocale(total, locale), date });

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable: hide just for this render */
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-2 rounded-[12px] border border-[#f5d08a]/40 bg-[#f5d08a]/10 px-3 py-2 text-[12px] text-[#f5d08a]"
    >
      <span className="min-w-0 flex-1 leading-snug">{text}</span>
      <Link
        href="/dues"
        className="shrink-0 rounded-full bg-[#f5d08a] px-3 py-1 text-[12px] font-semibold text-[#2a1f00]"
      >
        {t("payNow")}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dueBannerDismiss")}
        className="shrink-0 px-1 text-[#f5d08a]/70"
      >
        <span aria-hidden>✕</span>
      </button>
    </div>
  );
}
