import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { ChatWidget } from "../src";

// The widget now holds the launcher until the server config arrives, so
// tests need to await microtasks after render before the bubble is in
// the DOM. The stubbed fetch resolves with {} which marks `configLoaded`.
async function flushConfig() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  cleanup();
  // The widget fetches remote config on mount — stub fetch so it resolves
  // without network access and the component can render.
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

describe("ChatWidget", () => {
  it("mounts without throwing given minimal props", () => {
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    expect(container).toBeTruthy();
  });

  it("renders a chat bubble trigger by default", async () => {
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    await flushConfig();
    // We don't assert visible text (it's localized) — just that the widget
    // produced DOM output once the config has loaded.
    expect(container.children.length).toBeGreaterThan(0);
  });
});
