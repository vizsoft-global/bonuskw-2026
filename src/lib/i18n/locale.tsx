"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Locale } from "./content";
import { messages, t, type MessageKey, type MessageVars } from "./messages";

const STORAGE_KEY = "ba_locale";

type Translate = (key: MessageKey, vars?: MessageVars) => string;

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: Translate;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "ar" || stored === "en") return stored;
  const cookie = document.cookie.match(/(?:^|; )ba_locale=(ar|en)/)?.[1];
  if (cookie === "ar" || cookie === "en") return cookie;
  return "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(readInitialLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `ba_locale=${next};path=/;max-age=31536000;samesite=lax`;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      t: (key, vars) => t(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

const fallback: LocaleContextValue = {
  locale: "en",
  dir: "ltr",
  setLocale: () => undefined,
  t: (key, vars) => t("en", key, vars),
};

export function useI18n() {
  return useContext(LocaleContext) ?? fallback;
}

export { messages };
