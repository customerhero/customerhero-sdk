import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CustomerHeroChat } from "../src";

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

describe("sendMessage over SSE", () => {
  it("sets Accept: text/event-stream and accumulates tokens into one bot bubble", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    let acceptHeader: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers as HeadersInit);
        acceptHeader = headers.get("Accept");
        return sseStream([
          { event: "metadata", data: JSON.stringify({ conversationId: "c1" }) },
          { event: "token", data: JSON.stringify({ text: "Hi " }) },
          { event: "token", data: JSON.stringify({ text: "there." }) },
          { event: "done", data: "{}" },
        ]);
      }),
    );

    await chat.sendMessage("hello");

    expect(acceptHeader).toBe("text/event-stream");
    const msgs = chat.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].status).toBe("sent");
    expect(msgs[1].role).toBe("bot");
    expect(msgs[1].content).toBe("Hi there.");
    expect(msgs[1].streaming).toBeFalsy();
  });

  it("user bubble is `sending` while fetch is pending, then `sent` once the response is accepted", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });

    // Build a stream we can advance by hand to inspect mid-stream state.
    let advance: ((next: string) => void) | null = null;
    let close: (() => void) | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        advance = (chunk) => controller.enqueue(enc.encode(chunk));
        close = () => controller.close();
      },
    });

    // Hold fetch open so we can observe the `sending` state. The bubble
    // flips to `sent` as soon as the response promise resolves with a 2xx —
    // we no longer wait for the SSE `metadata` event because `prepareChat`
    // on the server can take seconds before the first event is emitted.
    let resolveFetch: ((r: Response) => void) | null = null;
    const fetchPromise = new Promise<Response>((res) => {
      resolveFetch = res;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => fetchPromise),
    );

    const sendPromise = chat.sendMessage("hi");
    await new Promise((r) => setTimeout(r, 0));

    // fetch is still pending → user bubble is `sending`.
    expect(chat.getState().messages[0].status).toBe("sending");

    resolveFetch!(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    await new Promise((r) => setTimeout(r, 0));

    // Response accepted by the server → bubble is `sent`, even before any
    // SSE event has arrived.
    expect(chat.getState().messages[0].status).toBe("sent");

    advance!(`event: metadata\ndata: {"conversationId":"c1"}\n\n`);
    advance!(`event: done\ndata: {}\n\n`);
    close!();
    await sendPromise;
  });

  it("bot bubble carries streaming: true until `done` clears it", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    let advance: ((next: string) => void) | null = null;
    let close: (() => void) | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        advance = (chunk) => controller.enqueue(enc.encode(chunk));
        close = () => controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(body, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );

    const sendPromise = chat.sendMessage("hi");
    await new Promise((r) => setTimeout(r, 0));

    advance!(`event: metadata\ndata: {"conversationId":"c1"}\n\n`);
    advance!(`event: token\ndata: {"text":"Hello"}\n\n`);
    await new Promise((r) => setTimeout(r, 0));
    const bot = chat.getState().messages.find((m) => m.role === "bot");
    expect(bot?.streaming).toBe(true);

    advance!(`event: done\ndata: {}\n\n`);
    close!();
    await sendPromise;
    const finalBot = chat.getState().messages.find((m) => m.role === "bot");
    expect(finalBot?.streaming).toBeFalsy();
  });

  it("flips user bubble to `failed` and surfaces the error when POST fails", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Boom" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await chat.sendMessage("hi");

    const state = chat.getState();
    expect(state.messages[0].status).toBe("failed");
    expect(state.error).toContain("Boom");
    expect(state.isLoading).toBe(false);
  });

  it("mid-stream `event: error` surfaces the error and clears the streaming caret", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseStream([
          { event: "metadata", data: JSON.stringify({ conversationId: "c1" }) },
          { event: "token", data: JSON.stringify({ text: "Partial " }) },
          {
            event: "error",
            data: JSON.stringify({ error: "Stream blew up" }),
          },
        ]),
      ),
    );

    await chat.sendMessage("hi");

    const state = chat.getState();
    // User bubble was accepted (metadata fired before the error), so it's
    // sent — not failed.
    expect(state.messages[0].status).toBe("sent");
    expect(state.error).toContain("Stream blew up");
    const bot = state.messages.find((m) => m.role === "bot");
    expect(bot?.content).toBe("Partial ");
    expect(bot?.streaming).toBeFalsy();
  });
});
