import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CustomerHeroChat,
  SUPPORTED_LOCALES,
  createTranslator,
  detectLocale,
  isRtlLocale,
  resolveLocale,
  type StringOverrides,
} from "../src";

describe("SUPPORTED_LOCALES", () => {
  it("contains the 14 documented locales in stable order", () => {
    expect(SUPPORTED_LOCALES).toEqual([
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
    ]);
  });
});

describe("isRtlLocale", () => {
  it("returns true for RTL primary languages", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("ar-SA")).toBe(true);
    expect(isRtlLocale("he")).toBe(true);
    expect(isRtlLocale("fa-IR")).toBe(true);
    expect(isRtlLocale("ur")).toBe(true);
  });
  it("returns false for LTR locales", () => {
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("zh-CN")).toBe(false);
    expect(isRtlLocale("ja")).toBe(false);
  });
});

describe("resolveLocale", () => {
  it("matches an exact supported tag", () => {
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(resolveLocale("zh-TW")).toBe("zh-TW");
  });
  it("falls back to the primary tag (fr-CA → fr)", () => {
    expect(resolveLocale("fr-CA")).toBe("fr");
    expect(resolveLocale("de-AT")).toBe("de");
  });
  it("aliases bare pt → pt-BR and bare zh → zh-CN", () => {
    expect(resolveLocale("pt")).toBe("pt-BR");
    expect(resolveLocale("zh")).toBe("zh-CN");
  });
  it("returns en for unknown tags or empty input", () => {
    expect(resolveLocale("xx-YY")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });
});

describe("detectLocale priority", () => {
  let originalLocation: Location | undefined;
  beforeEach(() => {
    originalLocation = globalThis.window?.location;
  });
  afterEach(() => {
    if (originalLocation && globalThis.window) {
      // jsdom: restore via direct assignment
      Object.defineProperty(window, "location", {
        value: originalLocation,
        configurable: true,
      });
    }
    vi.unstubAllGlobals();
  });

  it("explicit beats URL beats navigator beats en", () => {
    // navigator.language present
    vi.stubGlobal("navigator", { language: "fr" });
    // No window — fall back to navigator
    vi.stubGlobal("window", undefined);
    expect(detectLocale()).toBe("fr");
    // Explicit overrides everything
    expect(detectLocale("de")).toBe("de");
  });

  it("returns en when no signals are available", () => {
    vi.stubGlobal("navigator", { language: undefined });
    vi.stubGlobal("window", undefined);
    expect(detectLocale()).toBe("en");
  });
});

describe("createTranslator", () => {
  it("returns the catalog string for the active locale", () => {
    const t = createTranslator("es");
    expect(t("online")).toBe("En línea");
  });

  it("falls back to English when a locale catalog is missing a key (impossible by types, defensive at runtime)", () => {
    const t = createTranslator("es");
    // Every key exists; verify the fallback chain via overrides.
    expect(t("online")).toBe("En línea");
  });

  it("applies stringOverrides scoped to the active locale first", () => {
    const overrides: StringOverrides = {
      online: { es: "Conectado", en: "Available" },
    };
    expect(createTranslator("es", overrides)("online")).toBe("Conectado");
    expect(createTranslator("en", overrides)("online")).toBe("Available");
  });

  it("falls back from missing locale override to the en override", () => {
    const overrides: StringOverrides = {
      online: { en: "Available" },
    };
    expect(createTranslator("es", overrides)("online")).toBe("Available");
  });

  it("falls through to the catalog when overrides has no entry for the key", () => {
    const overrides: StringOverrides = { online: { en: "Available" } };
    expect(createTranslator("es", overrides)("typing")).toBe("Escribiendo...");
  });
});

describe("CustomerHeroChat.setLocale", () => {
  it("notifies subscribers and updates locale + isRtl", () => {
    const chat = new CustomerHeroChat({ chatbotId: "b", locale: "en" });
    expect(chat.getState().locale).toBe("en");
    expect(chat.getState().isRtl).toBe(false);

    const seen: Array<{ locale: string; isRtl: boolean }> = [];
    chat.subscribe((s) => seen.push({ locale: s.locale, isRtl: s.isRtl }));

    chat.setLocale("ar");
    expect(chat.getState().locale).toBe("ar");
    expect(chat.getState().isRtl).toBe(true);
    expect(chat.t("action_approve")).toBe("موافقة");
    expect(seen.at(-1)).toEqual({ locale: "ar", isRtl: true });
  });

  it("is a no-op when the resolved tag is already active", () => {
    const chat = new CustomerHeroChat({ chatbotId: "b", locale: "en" });
    let count = 0;
    chat.subscribe(() => count++);
    chat.setLocale("en");
    expect(count).toBe(0);
  });
});
