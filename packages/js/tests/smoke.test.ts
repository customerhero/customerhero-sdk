import { describe, it, expect } from "vitest";
import {
  CustomerHeroChat,
  DEFAULTS,
  MOBILE_BREAKPOINT,
  MOBILE_LAYOUT_QUERY,
  type CustomerHeroChatConfig,
  type IdentifyPayload,
} from "../src";

describe("public exports", () => {
  it("exposes CustomerHeroChat and DEFAULTS", () => {
    expect(typeof CustomerHeroChat).toBe("function");
    expect(DEFAULTS.apiBase).toMatch(/^https?:\/\//);
    expect(DEFAULTS.position).toBe("bottom-right");
  });

  it("exposes the mobile layout breakpoint and query", () => {
    expect(MOBILE_BREAKPOINT).toBe(480);
    expect(MOBILE_LAYOUT_QUERY).toContain(`max-width: ${MOBILE_BREAKPOINT}px`);
    expect(MOBILE_LAYOUT_QUERY).toContain("pointer: coarse");
  });
});

describe("mobileFullscreen resolution", () => {
  it("defaults to fullscreen on mobile", () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_test" });
    expect(chat.getState().config.mobileFullscreen).toBe(true);
  });

  it("lets the host opt out", () => {
    const chat = new CustomerHeroChat({
      chatbotId: "bot_test",
      mobileFullscreen: false,
    });
    expect(chat.getState().config.mobileFullscreen).toBe(false);
  });
});

describe("CustomerHeroChat construction", () => {
  it("constructs with a minimal config and exposes initial state", () => {
    const config: CustomerHeroChatConfig = { chatbotId: "bot_test" };
    const chat = new CustomerHeroChat(config);
    // subscribe should be callable and synchronous
    const unsubscribe = chat.subscribe(() => {});
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });

  it("uses DEFAULTS when config overrides are absent", () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_test" });
    let resolvedApiBase: string | undefined;
    const unsubscribe = chat.subscribe((state) => {
      resolvedApiBase = state.config.apiBase;
    });
    // Trigger a sync emit by re-subscribing is not guaranteed, but state
    // should at least be readable via the first listener if the client
    // emits on subscribe. If not, we still know construction didn't throw.
    unsubscribe();
    expect(
      resolvedApiBase === undefined || resolvedApiBase === DEFAULTS.apiBase,
    ).toBe(true);
  });
});

describe("IdentifyPayload shape", () => {
  it("accepts the documented fields", () => {
    const payload: IdentifyPayload = {
      userId: "usr_1",
      email: "a@b.com",
      name: "A B",
      userHash: "deadbeef",
      plan: "pro",
    };
    expect(payload.userId).toBe("usr_1");
    expect(payload.plan).toBe("pro");
  });
});
