import type { Locale } from "./content";
import { auth } from "./dictionaries/auth";
import { catalog } from "./dictionaries/catalog";
import { commerce } from "./dictionaries/commerce";
import { core } from "./dictionaries/core";
import { design } from "./dictionaries/design";
import { learning } from "./dictionaries/learning";
import { profile } from "./dictionaries/profile";

/**
 * Each feature owns one dictionary file under `dictionaries/`. They are merged
 * here so `t()` accepts any key from any of them. Keys must be unique across
 * dictionaries; later entries win if they collide, so avoid collisions.
 */
const dictionaries = [core, auth, catalog, learning, commerce, profile, design] as const;

type Dictionary = (typeof dictionaries)[number];
type KeysOf<T> = T extends { en: infer E } ? keyof E : never;

export type MessageKey = Extract<KeysOf<Dictionary>, string>;
type Messages = Record<Locale, Record<string, string>>;

function merge(locale: Locale): Record<string, string> {
  return Object.assign({}, ...dictionaries.map((d) => d[locale] as Record<string, string>));
}

export const messages: Messages = { en: merge("en"), ar: merge("ar") };

export type MessageVars = Record<string, string | number>;

function interpolate(template: string, vars?: MessageVars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export function t(locale: Locale, key: MessageKey, vars?: MessageVars) {
  const template = messages[locale][key] ?? messages.en[key] ?? key;
  return interpolate(template, vars);
}
