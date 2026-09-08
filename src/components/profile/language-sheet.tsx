"use client";

import { LangRadio } from "@/components/profile/ui";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/content";

export function LanguageSheet({
  open,
  locale,
  onLocale,
  onClose,
  title,
}: {
  open: boolean;
  locale: Locale;
  onLocale: (locale: Locale) => void;
  onClose: () => void;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-[#141414] pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5">
        <div className="mx-auto mb-4 h-0.5 w-[30px] rounded-full bg-white/30" />
        <p className="px-[19px] text-[16px] font-semibold text-[#fafafa]">{title}</p>
        <div className="mt-5 flex gap-3 px-[17px]">
          <LangChoice label="English" selected={locale === "en"} onSelect={() => onLocale("en")} />
          <LangChoice label="العربية" selected={locale === "ar"} onSelect={() => onLocale("ar")} />
        </div>
      </div>
    </div>
  );
}

export function LangChoice({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-12 flex-1 items-center justify-between rounded-[16px] border px-5 text-[16px] font-medium",
        selected ? "border-white/40 text-[#fafafa]" : "border-white/15 text-[#fafafa]",
      )}
    >
      {label}
      <LangRadio selected={selected} />
    </button>
  );
}
