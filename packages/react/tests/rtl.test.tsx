import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { ChatWidget } from "../src";

// Same gating as in chat-widget.test.tsx — the launcher only appears once
// the server config has resolved.
async function flushConfig() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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

describe("RTL widget rendering", () => {
  it("renders the launcher with dir=ltr for an LTR locale", async () => {
    const { container } = render(
      <ChatWidget chatbotId="bot_test" locale="en" />,
    );
    await flushConfig();
    const launcher = container.querySelector("button[dir]");
    expect(launcher?.getAttribute("dir")).toBe("ltr");
  });

  it("renders the launcher with dir=rtl for an RTL locale", async () => {
    const { container } = render(
      <ChatWidget chatbotId="bot_test" locale="ar" />,
    );
    await flushConfig();
    const launcher = container.querySelector("button[dir]");
    expect(launcher?.getAttribute("dir")).toBe("rtl");
  });

  it("flips the launcher corner from right to left under RTL", async () => {
    const { container: ltr } = render(
      <ChatWidget chatbotId="bot_test" locale="en" />,
    );
    await flushConfig();
    const ltrLauncher = ltr.querySelector("button[dir]") as HTMLElement | null;
    expect(ltrLauncher?.style.right).toBe("20px");
    expect(ltrLauncher?.style.left).toBe("");

    cleanup();

    const { container: rtl } = render(
      <ChatWidget chatbotId="bot_test" locale="ar" />,
    );
    await flushConfig();
    const rtlLauncher = rtl.querySelector("button[dir]") as HTMLElement | null;
    expect(rtlLauncher?.style.left).toBe("20px");
    expect(rtlLauncher?.style.right).toBe("");
  });
});
