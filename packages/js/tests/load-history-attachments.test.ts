import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CustomerHeroChat } from "../src";

// loadHistory() runs as part of the configure() bootstrap when there's a
// stored conversationId in localStorage. Seeding the conv id before the
// constructor runs is what gets the history fetch fired.

describe("loadHistory hydrates attachments", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage);
    localStorage.setItem("ch_conv_bot_x", "conv_1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps server attachments[] onto each ChatMessage", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/widget/bot_x/config")) {
        return new Response(JSON.stringify({ name: "Bot" }), { status: 200 });
      }
      if (url.includes("/messages/conv_1")) {
        return new Response(
          JSON.stringify({
            messages: [
              {
                id: "msg_1",
                role: "user",
                content: "Here's a screenshot",
                attachments: [
                  {
                    id: "att_1",
                    kind: "image",
                    mimeType: "image/png",
                    filename: "screen.png",
                    sizeBytes: 12345,
                    url: "https://cdn.example.com/screen.png",
                    location: null,
                  },
                ],
              },
              {
                id: "msg_2",
                role: "user",
                content: "and the report",
                attachments: [
                  {
                    id: "att_2",
                    kind: "document",
                    mimeType: "application/pdf",
                    filename: "report.pdf",
                    sizeBytes: 999,
                    url: "https://cdn.example.com/report.pdf",
                    location: null,
                  },
                ],
              },
              {
                id: "msg_3",
                role: "bot",
                content: "Got it.",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    // configure() (called by the React layer on mount) triggers loadHistory.
    await chat.fetchConfig();

    const msgs = chat.getState().messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[0].attachments).toEqual([
      {
        id: "att_1",
        kind: "image",
        mimeType: "image/png",
        filename: "screen.png",
        sizeBytes: 12345,
        url: "https://cdn.example.com/screen.png",
        location: null,
      },
    ]);
    expect(msgs[1].attachments?.[0].kind).toBe("document");
    // Messages without attachments should not get an empty array.
    expect(msgs[2].attachments).toBeUndefined();
  });

  it("omits attachments key when the server returns an empty array", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/widget/bot_x/config")) {
        return new Response(JSON.stringify({ name: "Bot" }), { status: 200 });
      }
      if (url.includes("/messages/conv_1")) {
        return new Response(
          JSON.stringify({
            messages: [
              {
                id: "msg_1",
                role: "user",
                content: "hello",
                attachments: [],
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();

    const msgs = chat.getState().messages;
    expect(msgs[0].attachments).toBeUndefined();
  });
});
