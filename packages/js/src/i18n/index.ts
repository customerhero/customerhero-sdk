import type { TranslationKey, Translations } from "./keys";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { ptBR } from "./locales/pt-BR";
import { ptPT } from "./locales/pt-PT";
import { fr } from "./locales/fr";
import { de } from "./locales/de";
import { it } from "./locales/it";
import { nl } from "./locales/nl";
import { pl } from "./locales/pl";
import { tr } from "./locales/tr";
import { ar } from "./locales/ar";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { zhCN } from "./locales/zh-CN";
import { zhTW } from "./locales/zh-TW";

export type { TranslationKey, Translations };

export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt-BR",
  "pt-PT",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "tr",
  "ar",
  "ja",
  "ko",
  "zh-CN",
  "zh-TW",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const catalog: Record<SupportedLocale, Translations> = {
  en,
  es,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  fr,
  de,
  it,
  nl,
  pl,
  tr,
  ar,
  ja,
  ko,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

const RTL_PRIMARY_LANGS = new Set(["ar", "he", "fa", "ur"]);

export function isRtlLocale(locale: string): boolean {
  return RTL_PRIMARY_LANGS.has(locale.split("-")[0].toLowerCase());
}

// Resolve any IETF tag (or arbitrary string) to one of the supported locales.
// Order: exact match → case-insensitive region match → primary-tag aliases
// (`pt` → `pt-BR`, `zh` → `zh-CN`) → primary-tag fallback (`fr-CA` → `fr`) → en.
export function resolveLocale(locale: string | undefined): SupportedLocale {
  if (!locale) return "en";
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale as SupportedLocale;
  }
  const ciMatch = SUPPORTED_LOCALES.find(
    (l) => l.toLowerCase() === locale.toLowerCase(),
  );
  if (ciMatch) return ciMatch;
  const base = locale.split("-")[0].toLowerCase();
  if (base === "pt") return "pt-BR";
  if (base === "zh") return "zh-CN";
  if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
    return base as SupportedLocale;
  }
  return "en";
}

// Resolve the active locale at construction or `setLocale` time.
// Order: explicit > `?lang=` > `navigator.language` > en.
export function detectLocale(explicit?: string): SupportedLocale {
  if (explicit) return resolveLocale(explicit);
  if (typeof window !== "undefined" && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const lang = params.get("lang");
      if (lang) return resolveLocale(lang);
    } catch {
      // Malformed URL — fall through.
    }
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return resolveLocale(navigator.language);
  }
  return "en";
}

// Per-chatbot string overrides keyed by translation key, then locale.
// Resolution order in `createTranslator`:
//   overrides[key][locale] → overrides[key].en → catalog[locale][key]
//   → catalog.en[key] → key (the literal string, as a last-resort fallback).
export type StringOverrides = Partial<
  Record<TranslationKey, Partial<Record<string, string>>>
>;

export type TranslateFn = (key: TranslationKey) => string;

export function createTranslator(
  locale: SupportedLocale,
  overrides?: StringOverrides,
): TranslateFn {
  const translations = catalog[locale] ?? catalog.en;
  return (key) => {
    const ov = overrides?.[key];
    if (ov) {
      const localized = ov[locale];
      if (typeof localized === "string") return localized;
      const enOverride = ov.en;
      if (typeof enOverride === "string") return enOverride;
    }
    return translations[key] ?? catalog.en[key] ?? key;
  };
}
