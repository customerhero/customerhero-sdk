import { describe, it, expect } from "vitest";
import {
  evaluate,
  pickFire,
  type VisitorContext,
  type TriggerDefinition,
} from "../src";

function ctx(overrides: Partial<VisitorContext> = {}): VisitorContext {
  return {
    url: "https://example.com/pricing?utm_source=ad",
    queryParams: { utm_source: "ad" },
    referrer: "https://google.com/",
    language: "en-us",
    device: "desktop",
    timeOnPageMs: 0,
    scrollPercent: 0,
    exitIntentSeen: false,
    returnVisitCount: 1,
    traits: {},
    ...overrides,
  };
}

describe("evaluate", () => {
  it("matches url_path with each operator", () => {
    const c = ctx();
    expect(
      evaluate({ kind: "url_path", op: "equals", value: "/pricing" }, c),
    ).toBe(true);
    expect(
      evaluate({ kind: "url_path", op: "contains", value: "ric" }, c),
    ).toBe(true);
    expect(
      evaluate({ kind: "url_path", op: "starts_with", value: "/pric" }, c),
    ).toBe(true);
    expect(
      evaluate({ kind: "url_path", op: "regex", value: "^/pric" }, c),
    ).toBe(true);
    expect(
      evaluate({ kind: "url_path", op: "equals", value: "/blog" }, c),
    ).toBe(false);
  });

  it("matches url_query exists/equals/contains", () => {
    const c = ctx();
    expect(
      evaluate({ kind: "url_query", key: "utm_source", op: "exists" }, c),
    ).toBe(true);
    expect(
      evaluate(
        { kind: "url_query", key: "utm_source", op: "equals", value: "ad" },
        c,
      ),
    ).toBe(true);
    expect(
      evaluate({ kind: "url_query", key: "missing", op: "exists" }, c),
    ).toBe(false);
  });

  it("matches time_on_page and scroll_depth thresholds", () => {
    expect(
      evaluate(
        { kind: "time_on_page", seconds: 30 },
        ctx({ timeOnPageMs: 31_000 }),
      ),
    ).toBe(true);
    expect(
      evaluate(
        { kind: "time_on_page", seconds: 30 },
        ctx({ timeOnPageMs: 1_000 }),
      ),
    ).toBe(false);
    expect(
      evaluate(
        { kind: "scroll_depth", percent: 50 },
        ctx({ scrollPercent: 60 }),
      ),
    ).toBe(true);
  });

  it("matches browser_language with prefix support", () => {
    expect(
      evaluate(
        { kind: "browser_language", op: "in", values: ["en"] },
        ctx({ language: "en-us" }),
      ),
    ).toBe(true);
    expect(
      evaluate(
        { kind: "browser_language", op: "in", values: ["es", "fr"] },
        ctx({ language: "en-us" }),
      ),
    ).toBe(false);
  });

  it("matches visitor_trait operators", () => {
    const c = ctx({ traits: { plan: "pro", credits: 100 } });
    expect(
      evaluate(
        { kind: "visitor_trait", key: "plan", op: "equals", value: "pro" },
        c,
      ),
    ).toBe(true);
    expect(
      evaluate({ kind: "visitor_trait", key: "plan", op: "exists" }, c),
    ).toBe(true);
    expect(
      evaluate(
        { kind: "visitor_trait", key: "credits", op: "gt", value: 50 },
        c,
      ),
    ).toBe(true);
    expect(
      evaluate(
        { kind: "visitor_trait", key: "credits", op: "lt", value: 50 },
        c,
      ),
    ).toBe(false);
  });

  it("ANDs and ORs nested groups", () => {
    const c = ctx({ scrollPercent: 70, timeOnPageMs: 5_000 });
    expect(
      evaluate(
        {
          all: [
            { kind: "scroll_depth", percent: 50 },
            { kind: "time_on_page", seconds: 3 },
          ],
        },
        c,
      ),
    ).toBe(true);
    expect(
      evaluate(
        {
          any: [
            { kind: "scroll_depth", percent: 90 },
            { kind: "time_on_page", seconds: 3 },
          ],
        },
        c,
      ),
    ).toBe(true);
    expect(
      evaluate(
        {
          all: [
            { kind: "scroll_depth", percent: 90 },
            { kind: "time_on_page", seconds: 3 },
          ],
        },
        c,
      ),
    ).toBe(false);
  });

  it("rejects malformed regex without throwing", () => {
    expect(() =>
      evaluate({ kind: "url_path", op: "regex", value: "[" }, ctx()),
    ).not.toThrow();
  });
});

describe("pickFire", () => {
  const t = (
    id: string,
    priority: number,
    seconds: number,
    frequency:
      | "once_ever"
      | "once_per_session"
      | "every_time" = "once_per_session",
  ): TriggerDefinition => ({
    id,
    priority,
    conditions: { kind: "time_on_page", seconds },
    action: { kind: "open_widget" },
    frequency,
  });

  it("returns the highest-priority matching trigger", () => {
    const triggers = [t("a", 100, 5), t("b", 50, 5), t("c", 200, 5)];
    const c = ctx({ timeOnPageMs: 10_000 });
    expect(pickFire(triggers, c, new Set())?.id).toBe("b");
  });

  it("skips triggers already fired (unless every_time)", () => {
    const triggers = [t("a", 50, 5, "once_per_session"), t("b", 100, 5)];
    const c = ctx({ timeOnPageMs: 10_000 });
    expect(pickFire(triggers, c, new Set(["a"]))?.id).toBe("b");

    const everyTime = t("a", 50, 5, "every_time");
    expect(pickFire([everyTime], c, new Set(["a"]))?.id).toBe("a");
  });

  it("returns null when nothing matches", () => {
    const triggers = [t("a", 100, 30)];
    const c = ctx({ timeOnPageMs: 1_000 });
    expect(pickFire(triggers, c, new Set())).toBe(null);
  });
});
