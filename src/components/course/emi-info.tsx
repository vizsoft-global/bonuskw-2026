"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

/** Installment breakup, behind a small icon rather than in the button. */
export function EmiInfo({ plan, total }: { plan: number[]; total?: number }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const money = (value: number) => formatKwdLocale(value, locale as Locale);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (plan.length < 2) return null;
  const sum = total ?? plan.reduce((s, v) => s + Number(v), 0);

  return (
    <span ref={root} className="relative inline-flex">
      <button
        type="button"
        aria-label={t("emiPayCount", { n: plan.length })}
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-full text-muted hover:text-text"
      >
        <Info className="size-4" />
      </button>
      {open ? (
        <span className="absolute end-0 bottom-10 z-30 w-56 rounded-xl border border-line bg-surface p-3 text-start shadow-xl">
          <span className="mb-2 block text-[12px] font-semibold text-text">{t("emiCount", { n: plan.length })}</span>
          <span className="flex flex-col gap-1.5">
            {plan.map((amount, index) => (
              <span key={index} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-muted">
                  {t("emiInstallment", { i: index + 1 })}
                  {index === 0 ? <span className="ms-1 text-[10px]">{t("emiDueNow")}</span> : null}
                </span>
                <span className="font-medium text-text">{money(Number(amount))}</span>
              </span>
            ))}
          </span>
          <span className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[12px] font-semibold text-text">
            <span>{t("totalDueNow")}</span>
            <span>{money(sum)}</span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
