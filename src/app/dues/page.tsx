"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { loadCart, saveCart, upsertLine, type CartLine, type CartState } from "@/lib/cart/store";
import { dueAt, isOverdue, useOutstandingDues, type OutstandingDue } from "@/lib/dues/outstanding";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

type Due = OutstandingDue;

function dueLine(due: Due): CartLine {
  return {
    kind: "installment",
    courseId: due.get("courseRef")?.id,
    installmentId: due.id,
    paymentType: "Full payment",
    title: due.get("courseName") || "Installment",
    price: due.get("amount"),
    addedAt: Date.now(),
  };
}

/**
 * Tranches are grouped by the calendar day they fall due, so one card answers
 * "what do I owe on the 25th" rather than listing every tranche flat.
 */
function dayKey(due: Due) {
  const at = dueAt(due);
  return at ? `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}` : "none";
}

/** The app has no checkbox primitive, so a labelled button carries the state. */
function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
        on ? "border-[#0c5eff] bg-[#0c5eff] text-white" : "border-line-strong bg-transparent",
      )}
    >
      {on ? (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Everything the student still owes, by due date, with a choice of what to pay.
 *
 * The page used to be a flat list with one "pay all" button; this keeps the same
 * plumbing — selected tranches become cart lines and checkout prices them — but
 * lets a student settle one tranche, one date, or everything in one charge.
 */
export default function DuesPage() {
  const { user } = useAuth();
  const gate = usePurchaseGate();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const dues = useOutstandingDues();

  // Memoised so the fallback array is not a fresh reference every render, which
  // would re-run the grouping below on every keystroke elsewhere on the page.
  const list = useMemo(() => dues.data ?? [], [dues.data]);

  const groups = useMemo(() => {
    const byDay = new Map<string, { at: Date | null; items: Due[] }>();
    for (const due of list) {
      const key = dayKey(due);
      const bucket = byDay.get(key) ?? { at: dueAt(due), items: [] };
      bucket.items.push(due);
      byDay.set(key, bucket);
    }
    return [...byDay.entries()]
      .map(([key, group]) => ({
        key,
        at: group.at,
        // A course's tranches read in plan order; only the day is fixed.
        items: group.items.sort(
          (a, b) =>
            String(a.get("courseName") ?? "").localeCompare(String(b.get("courseName") ?? "")) ||
            (Number(a.get("index")) || 0) - (Number(b.get("index")) || 0),
        ),
        overdue: group.items.some(isOverdue),
      }))
      // Oldest first: the most overdue date is the one that needs attention.
      .sort((a, b) => (a.at?.getTime() ?? Number.POSITIVE_INFINITY) - (b.at?.getTime() ?? Number.POSITIVE_INFINITY));
  }, [list]);

  const selected = list.filter((d) => picked.has(d.id));
  const selectedTotal = selected.reduce((sum, d) => sum + (Number(d.get("amount")) || 0), 0);

  const paused = gate.blockFor("installment");
  const money = (amount: number) => formatKwdLocale(amount, locale);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(items: Due[]) {
    setPicked((prev) => {
      const next = new Set(prev);
      const all = items.every((d) => next.has(d.id));
      for (const due of items) {
        if (all) next.delete(due.id);
        else next.add(due.id);
      }
      return next;
    });
  }

  async function pay(items: Due[]) {
    if (!user || busy || paused || items.length === 0) return;
    setBusy(true);
    try {
      let cart: CartState = await loadCart(user.uid);
      for (const due of items) cart = upsertLine(cart, dueLine(due));
      await saveCart(user.uid, cart);
      router.push("/cart");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      loading={dues.isPending}
      title={t("installmentsTitle")}
      skeleton={<ListPageSkeleton />}
    >
      {list.length ? (
        // Bottom padding keeps the last card clear of the sticky selection bar.
        <div className="flex flex-col gap-3 pb-28">
          {paused ? (
            <p className="rounded-[10px] bg-[#f5d08a]/10 p-3 text-[12px] leading-relaxed text-[#f5d08a]">
              {paused}
            </p>
          ) : null}
          <p className="text-[12px] leading-relaxed text-muted">{t("installmentsHint")}</p>

          {groups.map((group) => {
            const all = group.items.every((d) => picked.has(d.id));
            const chosen = group.items.filter((d) => picked.has(d.id)).length;
            const groupTotal = group.items.reduce((sum, d) => sum + (Number(d.get("amount")) || 0), 0);
            return (
              <section key={group.key} className="rounded-2xl bg-surface p-4">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.items)}
                    className="flex min-w-0 flex-wrap items-center gap-2 text-start"
                  >
                    <Tick on={all} />
                    <span className="text-[14px] font-semibold text-text">
                      {group.at
                        ? group.at.toLocaleDateString(locale === "ar" ? "ar-KW" : "en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        group.overdue
                          ? "bg-[#f24822]/15 text-[#f24822]"
                          : "bg-[#f5d08a]/15 text-[#f5d08a]",
                      )}
                    >
                      {group.overdue ? t("installmentOverdue") : t("installmentDue")}
                    </span>
                    {chosen > 0 && !all ? (
                      <span className="text-[11px] text-muted">
                        {t("installmentsSelected", { n: chosen })}
                      </span>
                    ) : null}
                  </button>
                  <span className="shrink-0 text-[13px] font-semibold text-text">
                    {money(groupTotal)}
                  </span>
                </div>

                <ul className="divide-y divide-line">
                  {group.items.map((due) => (
                    <li key={due.id}>
                      <button
                        type="button"
                        onClick={() => toggle(due.id)}
                        className="flex w-full items-start gap-3 py-3 text-start"
                      >
                        <Tick on={picked.has(due.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-text">
                            {String(due.get("courseName") ?? t("installmentOfShort"))}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {due.get("index") && due.get("count")
                              ? t("installmentOf", {
                                  index: Number(due.get("index")),
                                  count: Number(due.get("count")),
                                })
                              : t("installmentOfShort")}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold text-text">
                          {money(Number(due.get("amount")) || 0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={busy || Boolean(paused)}
                  onClick={() => void pay(group.items)}
                  className="mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl border border-line-strong px-4 text-[13px] font-semibold text-text disabled:opacity-60"
                >
                  {t("installmentPayAll")} · {money(groupTotal)}
                </button>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="/profile/clock.svg"
          title={t("emptyDuesTitle")}
          body={t("emptyDuesBody")}
        />
      )}

      {picked.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-app-top/95 px-3 pb-4 pt-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3 pb-2 text-[13px]">
            <span className="text-muted">{t("installmentsSelected", { n: picked.size })}</span>
            <span className="font-semibold text-text">{money(selectedTotal)}</span>
          </div>
          <button
            type="button"
            disabled={busy || Boolean(paused)}
            onClick={() => void pay(selected)}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#0c5eff] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {t("continue")} · {money(selectedTotal)}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
