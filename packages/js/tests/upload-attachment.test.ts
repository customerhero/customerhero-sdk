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

function sseStream(events: Array<{ event: string; data: string }>): Response {
  const body = events
    .map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`)
    .join("");
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(body));
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("uploadAttachment + sendMessage attachmentTokens passthrough", () => {
  it("POSTs multipart to the attachments endpoint and returns the token", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    const blob = new Blob(["fake-bytes"], { type: "image/jpeg" });

    let captured: { url: string; init?: RequestInit } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        captured = { url: String(input), init };
        return new Response(
          JSON.stringify({
            attachmentToken: "tok_abc",
            previewUrl: "https://media.example/abc.jpg",
            expiresAt: "2030-01-01T00:00:00Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const result = await chat.uploadAttachment(blob);
    expect(result.attachmentToken).toBe("tok_abc");
    expect(captured?.url).toContain("/api/chat/bot_x/attachments");
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.init?.body).toBeInstanceOf(FormData);
  });

  it("throws and surfaces the server's error message on non-2xx", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Too big" }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(
      chat.uploadAttachment(new Blob([], { type: "image/jpeg" })),
    ).rejects.toThrow(/Too big/);
  });

  it("forwards attachmentTokens in the chat POST body", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    let captured: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        captured = JSON.parse(String(init?.body ?? "{}"));
        return sseStream([
          { event: "metadata", data: JSON.stringify({ conversationId: "c1" }) },
          { event: "done", data: "{}" },
        ]);
      }),
    );

    await chat.sendMessage("look at this", {
      attachmentTokens: ["tok_1", "tok_2"],
    });
    expect((captured as { attachmentTokens?: string[] }).attachmentTokens).toEqual([
      "tok_1",
      "tok_2",
    ]);
  });
});
