import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { MOBILE_LAYOUT_QUERY } from "@customerhero/js";
import { ChatWidget } from "../src";

// Same config gating as the other widget tests — the launcher only appears
// once the (stubbed) server config has resolved.
async function flushConfig() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// Let queued animation frames / focus effects run.
async function flushFrames() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

/** Stub matchMedia so `matcher` decides which queries are considered active. */
function mockMatchMedia(matcher: (query: string) => boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: matcher(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

const isMobileViewport = (query: string) => query === MOBILE_LAYOUT_QUERY;
const isTouch = (query: string) => query === "(pointer: coarse)";

async function openWidget(container: HTMLElement) {
  const launcher = container.querySelector("button[dir]") as HTMLElement;
  await act(async () => {
    launcher.click();
  });
  return launcher;
}

/** The chat panel — the only non-launcher element carrying a `dir`. */
function panelOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector("div[dir]");
}

beforeEach(() => {
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fullscreen layout on mobile viewports", () => {
  it("fills the viewport when the panel opens on a phone-sized screen", async () => {
    mockMatchMedia(isMobileViewport);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    await openWidget(container);

    const panel = panelOf(container);
    expect(panel?.dataset.customerheroFullscreen).toBe("true");
    expect(panel?.style.position).toBe("fixed");
    expect(panel?.style.left).toBe("0px");
    expect(panel?.style.right).toBe("0px");
    expect(panel?.style.top).toBe("0px");
    expect(panel?.style.bottom).toBe("0px");
    expect(parseFloat(panel?.style.borderRadius ?? "")).toBe(0);
    expect(panel?.style.boxShadow).toBe("none");
  });

  it("keeps the floating panel on a desktop-sized screen", async () => {
    mockMatchMedia(() => false);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    await openWidget(container);

    const panel = panelOf(container);
    expect(panel?.dataset.customerheroFullscreen).toBeUndefined();
    expect(panel?.style.width).toBe("380px");
    expect(panel?.style.right).toBe("20px");
  });

  it("honours mobileFullscreen: false on a phone-sized screen", async () => {
    mockMatchMedia(isMobileViewport);
    const { container } = render(
      <ChatWidget chatbotId="bot_test" mobileFullscreen={false} />,
    );
    await flushConfig();
    await openWidget(container);

    const panel = panelOf(container);
    expect(panel?.dataset.customerheroFullscreen).toBeUndefined();
    expect(panel?.style.width).toBe("380px");
  });

  it("hides the launcher behind an open fullscreen panel", async () => {
    mockMatchMedia(isMobileViewport);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    const launcher = await openWidget(container);

    expect(launcher.getAttribute("aria-hidden")).toBe("true");
    expect(launcher.getAttribute("tabindex")).toBe("-1");
    expect(launcher.style.opacity).toBe("0");
    expect(launcher.style.pointerEvents).toBe("none");
  });

  it("restores the launcher when the panel closes", async () => {
    mockMatchMedia(isMobileViewport);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    const launcher = await openWidget(container);
    await act(async () => {
      launcher.click();
    });

    expect(launcher.getAttribute("aria-hidden")).toBeNull();
    expect(launcher.style.pointerEvents).toBe("auto");
  });

  it("locks and restores host page scrolling around a fullscreen panel", async () => {
    mockMatchMedia(isMobileViewport);
    document.body.style.overflow = "scroll";
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    const launcher = await openWidget(container);
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      launcher.click();
    });
    // The panel unmounts after its exit animation; the lock lifts with it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });
});

describe("touch-device input handling", () => {
  it("renders the composer at 16px so iOS does not zoom on focus", async () => {
    mockMatchMedia(isTouch);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    await openWidget(container);

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.style.fontSize).toBe("16px");
  });

  it("keeps the composer at its design size on pointer devices", async () => {
    mockMatchMedia(() => false);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    await openWidget(container);

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.style.fontSize).toBe("14px");
  });

  it("does not summon the keyboard by autofocusing on touch", async () => {
    mockMatchMedia(isTouch);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    await openWidget(container);
    await flushFrames();

    const textarea = container.querySelector("textarea");
    expect(document.activeElement).not.toBe(textarea);
  });

  it("still autofocuses the composer on pointer devices", async () => {
    mockMatchMedia(() => false);
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    await openWidget(container);
    await flushFrames();

    const textarea = container.querySelector("textarea");
    expect(document.activeElement).toBe(textarea);
  });
});
