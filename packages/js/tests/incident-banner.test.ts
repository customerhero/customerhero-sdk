import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CustomerHeroChat } from "../src";

beforeEach(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function configResponse(banner: unknown): Response {
  return new Response(
    JSON.stringify({
      chatbotId: "bot_x",
      primaryColor: "#000",
      backgroundColor: "#fff",
      textColor: "#111",
      position: "bottom-right",
      placeholderText: "Type...",
      welcomeMessage: "Hi",
      title: "Bot",
      triggers: [],
      ...(banner === undefined ? {} : { incidentBanner: banner }),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("incident banner — fetchConfig wiring", () => {
  it("hydrates state.incidentBanner with a complete payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        configResponse({
          severity: "outage",
          title: "Login is down",
          body: "Investigating",
          eta: "15:00 UTC",
          link: { url: "https://status.example.com", label: "Status" },
        }),
      ),
    );
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();
    const banner = chat.getState().incidentBanner;
    expect(banner).toEqual({
      severity: "outage",
      title: "Login is down",
      body: "Investigating",
      eta: "15:00 UTC",
      link: { url: "https://status.example.com", label: "Status" },
    });
    expect(chat.getState().incidentBannerDismissed).toBe(false);
  });

  it("drops malformed banners (bad severity, missing title, expired)", async () => {
    const cases: Array<{ name: string; payload: unknown }> = [
      { name: "bad severity", payload: { severity: "bogus", title: "x" } },
      { name: "missing title", payload: { severity: "info", title: "" } },
      { name: "non-object", payload: "nope" },
      {
        name: "expired",
        payload: {
          severity: "info",
          title: "Old",
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    ];
    for (const c of cases) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => configResponse(c.payload)),
      );
      const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
      await chat.fetchConfig();
      expect(chat.getState().incidentBanner, `case: ${c.name}`).toBeNull();
    }
  });

  it("drops the banner when the absent field is missing entirely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => configResponse(undefined)),
    );
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();
    expect(chat.getState().incidentBanner).toBeNull();
  });
});

describe("incident banner — dismissal", () => {
  it("dismissIncidentBanner flips the flag and persists per-chatbot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => configResponse({ severity: "info", title: "Hello" })),
    );
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();
    expect(chat.getState().incidentBannerDismissed).toBe(false);
    chat.dismissIncidentBanner();
    expect(chat.getState().incidentBannerDismissed).toBe(true);
    // Sanity: the dismissal landed in storage under a stable key.
    expect(localStorage.getItem("ch_incident_dismissed_bot_x")).toBeTruthy();

    // A second client for the same chatbot picks up the persisted dismissal.
    const chat2 = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat2.fetchConfig();
    expect(chat2.getState().incidentBannerDismissed).toBe(true);
  });

  it("resets dismissal when banner content changes", async () => {
    let banner: unknown = { severity: "info", title: "First" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => configResponse(banner)),
    );

    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();
    chat.dismissIncidentBanner();
    expect(chat.getState().incidentBannerDismissed).toBe(true);

    // Operator publishes a different banner — should reappear.
    banner = { severity: "outage", title: "Second" };
    await chat.fetchConfig();
    expect(chat.getState().incidentBanner?.title).toBe("Second");
    expect(chat.getState().incidentBannerDismissed).toBe(false);
  });

  it("dismissIncidentBanner is a no-op when no banner is showing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => configResponse(null)),
    );
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();
    expect(() => chat.dismissIncidentBanner()).not.toThrow();
    expect(chat.getState().incidentBannerDismissed).toBe(false);
  });
});
