"use client";

import { ChevronDown, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/locale";
import {
  EMPTY_SELECTION,
  optionsFor,
  useTaxonomy,
  type TaxNode,
  type TaxonomySelection,
} from "@/lib/taxonomy/use-taxonomy";
import { cn } from "@/lib/utils";

function Pill({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: TaxNode[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const active = Boolean(value);
  const name = options.find((o) => o.id === value)?.name;
  return (
    <label
      className={cn(
        "relative flex h-9 shrink-0 items-center gap-1.5 rounded-[27px] px-3 text-[13px] transition-colors",
        active ? "bg-[#f2f2f2] font-medium text-[#141414]" : "bg-[#141414] text-[#fafafa]",
        disabled && "opacity-40",
      )}
    >
      <span className="max-w-[9rem] truncate">{active ? name : label}</span>
      <ChevronDown className="size-3.5 shrink-0" />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
      >
        <option value="" className="bg-[#141414] text-white">
          {label}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#141414] text-white">
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Compact Country → University → Category → Topic filter shown above course
 * lists. Picking a level clears the ones below it; "All" clears everything.
 */
export function TaxonomyPicker({
  value,
  onChange,
  className,
}: {
  value: TaxonomySelection;
  onChange: (value: TaxonomySelection) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const tax = useTaxonomy();
  const options = optionsFor(tax, value);
  const school = tax.isSchool(value.university);
  const any = Boolean(value.country || value.university || value.category || value.topic);

  return (
    <div className={cn("flex gap-2 overflow-x-auto hide-scrollbar", className)}>
      <button
        type="button"
        onClick={() => onChange(EMPTY_SELECTION)}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-[27px] px-3 text-[13px]",
          !any ? "bg-[#f2f2f2] font-medium text-[#141414]" : "bg-[#141414] text-[#fafafa]",
        )}
      >
        {any ? <X className="size-3.5" /> : null}
        {t("all")}
      </button>
      <Pill
        label={t("country")}
        value={value.country}
        options={options.countries}
        onChange={(country) => onChange({ country, university: "", category: "", topic: "" })}
      />
      <Pill
        label={t("university")}
        value={value.university}
        options={options.universities}
        onChange={(university) => {
          const picked = tax.universities.find((u) => u.id === university);
          onChange({ country: picked?.countryId ?? value.country, university, category: "", topic: "" });
        }}
      />
      <Pill
        label={school ? t("grade") : t("category")}
        value={value.category}
        options={options.categories}
        onChange={(category) => {
          const picked = tax.categories.find((k) => k.id === category);
          onChange({
            ...value,
            university: picked?.universityId ?? value.university,
            category,
            topic: "",
          });
        }}
      />
      <Pill
        label={school ? t("subject") : t("topic")}
        value={value.topic}
        options={options.topics}
        onChange={(topic) => {
          const picked = tax.topics.find((b) => b.id === topic);
          onChange({
            ...value,
            category: picked?.categoryId ?? value.category,
            university: picked?.universityId ?? value.university,
            topic,
          });
        }}
      />
    </div>
  );
}
