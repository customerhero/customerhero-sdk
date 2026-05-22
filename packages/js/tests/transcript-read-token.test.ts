import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CustomerHeroChat } from "../src";

// C3: the widget receives a transcript-read token with each chat reply,
// persists it next to the conversationId, and presents it (as `?t=`) when
// loading history.

function sseStream(events: Array<{ event: string; data: string }>): Response {
  const body = events
    .map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`)
    .join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transcript-read token (C3)", () => {
  it("persists the read-token SSE event next to the conversationId", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseStream([
          { event: "metadata", data: JSON.stringify({ conversationId: "c1" }) },
          { event: "token", data: JSON.stringify({ text: "Hi" }) },
          { event: "done", data: "{}" },
          {
            event: "read-token",
            data: JSON.stringify({ readToken: "tok_xyz" }),
          },
        ]),
      ),
    );

    await chat.sendMessage("hello");

    expect(localStorage.getItem("ch_conv_bot_x")).toBe("c1");
    expect(localStorage.getItem("ch_conv_token_bot_x")).toBe("tok_xyz");
  });

  it("sends the stored token as the `t` query param when loading history", async () => {
    localStorage.setItem("ch_conv_bot_x", "conv_1");
    localStorage.setItem("ch_conv_token_bot_x", "tok_abc");

    let messagesUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/widget/bot_x/config")) {
          return new Response(JSON.stringify({ name: "Bot" }), { status: 200 });
        }
        if (url.includes("/messages/conv_1")) {
          messagesUrl = url;
          return new Response(JSON.stringify({ messages: [] }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();

    expect(messagesUrl).toContain("t=tok_abc");
  });

  it("clears the conversation and token when the read returns 403", async () => {
    localStorage.setItem("ch_conv_bot_x", "conv_1");
    localStorage.setItem("ch_conv_token_bot_x", "tok_stale");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/widget/bot_x/config")) {
          return new Response(JSON.stringify({ name: "Bot" }), { status: 200 });
        }
        if (url.includes("/messages/conv_1")) {
          return new Response(
            JSON.stringify({ error: "Invalid transcript token" }),
            {
              status: 403,
            },
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    await chat.fetchConfig();

    expect(chat.getState().conversationId).toBeNull();
    expect(localStorage.getItem("ch_conv_bot_x")).toBeNull();
    expect(localStorage.getItem("ch_conv_token_bot_x")).toBeNull();
  });

  it("reset() clears the stored read token", async () => {
    localStorage.setItem("ch_conv_bot_x", "conv_1");
    localStorage.setItem("ch_conv_token_bot_x", "tok_abc");

    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    chat.reset();

    expect(localStorage.getItem("ch_conv_token_bot_x")).toBeNull();
  });
});
