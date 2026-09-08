export type Locale = "en" | "ar";

type TranslateMap = { en?: string; ar?: string } | null | undefined;

export function localizedField(
  base: string | undefined,
  manual: TranslateMap,
  auto: TranslateMap,
  locale: Locale,
) {
  if (locale === "en") return base || manual?.en || auto?.en || "";
  return manual?.ar || auto?.ar || base || "";
}

export function formatKwdLocale(amount: number | null | undefined, locale: Locale) {
  const n = Number(amount) || 0;
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-KW" : "en-KW", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
  return `${formatted} KWD`;
}
