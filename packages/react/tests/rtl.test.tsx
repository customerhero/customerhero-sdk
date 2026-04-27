import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { ChatWidget } from "../src";

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
  it("renders the launcher with dir=ltr for an LTR locale", () => {
    const { container } = render(
      <ChatWidget chatbotId="bot_test" locale="en" />,
    );
    const launcher = container.querySelector("button[dir]");
    expect(launcher?.getAttribute("dir")).toBe("ltr");
  });

  it("renders the launcher with dir=rtl for an RTL locale", () => {
    const { container } = render(
      <ChatWidget chatbotId="bot_test" locale="ar" />,
    );
    const launcher = container.querySelector("button[dir]");
    expect(launcher?.getAttribute("dir")).toBe("rtl");
  });

  it("flips the launcher corner from right to left under RTL", () => {
    const { container: ltr } = render(
      <ChatWidget chatbotId="bot_test" locale="en" />,
    );
    const ltrLauncher = ltr.querySelector("button[dir]") as HTMLElement | null;
    expect(ltrLauncher?.style.right).toBe("20px");
    expect(ltrLauncher?.style.left).toBe("");

    cleanup();

    const { container: rtl } = render(
      <ChatWidget chatbotId="bot_test" locale="ar" />,
    );
    const rtlLauncher = rtl.querySelector("button[dir]") as HTMLElement | null;
    expect(rtlLauncher?.style.left).toBe("20px");
    expect(rtlLauncher?.style.right).toBe("");
  });
});

// Avoid an unused-import lint flag for `act`.
void act;
