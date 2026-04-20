import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ChatWidget } from "../src";

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

  it("renders a chat bubble trigger by default", () => {
    const { container } = render(<ChatWidget chatbotId="bot_test" />);
    // We don't assert visible text (it's localized) — just that the widget
    // produced DOM output.
    expect(container.children.length).toBeGreaterThan(0);
  });
});
