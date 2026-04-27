import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CustomerHeroChat, type ActionConfirmationBlock } from "../src";

// Build a JSON-encoded SSE response body from a list of events.
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

const block: ActionConfirmationBlock = {
  type: "action_confirmation",
  pendingToolCallId: "ptc_1",
  actionName: "send_email",
  title: "Send the email?",
  summary: "I'll email support@example.com.",
  approveHref: "/api/chat/bot_x/tool-calls/ptc_1/decision?decision=approve",
  cancelHref: "/api/chat/bot_x/tool-calls/ptc_1/decision?decision=cancel",
};

function seedBubbleWithBlock(chat: CustomerHeroChat) {
  // Inject a bot message carrying the action_confirmation block by replaying
  // a streamed `block` event; the public API for hydrating blocks is the SSE
  // stream from `sendMessage`, which we exercise indirectly here.
  // For test setup we reach into state by triggering a sendMessage round
  // that returns just a `block` then `done`.
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/chat/bot_x")) {
      return sseStream([
        { event: "metadata", data: JSON.stringify({ conversationId: "c_1" }) },
        { event: "token", data: JSON.stringify({ text: "I can do that. " }) },
        { event: "block", data: JSON.stringify({ block }) },
        { event: "done", data: "{}" },
      ]);
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("action confirmation in CustomerHeroChat", () => {
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

  it("hydrates an action_confirmation block from sendMessage SSE", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    seedBubbleWithBlock(chat);

    await chat.sendMessage("hello");

    const msgs = chat.getState().messages;
    const bot = msgs[msgs.length - 1];
    expect(bot.role).toBe("bot");
    expect(bot.blocks).toHaveLength(1);
    expect(bot.blocks?.[0]).toMatchObject({
      type: "action_confirmation",
      pendingToolCallId: "ptc_1",
    });
  });

  it("supersede-on-send strips the action_confirmation card before the next request", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    seedBubbleWithBlock(chat);
    await chat.sendMessage("hello");

    // Now send a follow-up. Replace fetch with one that captures pre-flight
    // state (when the request is in flight, the local card should be gone).
    let stateAtRequestTime: ReturnType<CustomerHeroChat["getState"]> | null =
      null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        stateAtRequestTime = chat.getState();
        return sseStream([{ event: "done", data: "{}" }]);
      }),
    );

    await chat.sendMessage("never mind");

    expect(stateAtRequestTime).not.toBeNull();
    const botMsg = stateAtRequestTime!.messages.find((m) => m.role === "bot");
    expect(
      botMsg?.blocks?.some((b) => b.type === "action_confirmation"),
    ).toBeFalsy();
  });

  it("approveAction streams tokens into the existing bubble and clears streaming on done", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    seedBubbleWithBlock(chat);
    await chat.sendMessage("hello");

    const decisionFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toContain("/tool-calls/ptc_1/decision");
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body.decision).toBe("approve");
        return sseStream([
          { event: "token", data: JSON.stringify({ text: "Done!" }) },
          { event: "done", data: "{}" },
        ]);
      },
    );
    vi.stubGlobal("fetch", decisionFetch);

    await chat.approveAction("ptc_1");

    const msgs = chat.getState().messages;
    const bot = msgs.find((m) => m.role === "bot")!;
    expect(bot.content).toContain("Done!");
    expect(bot.streaming).toBeFalsy();
    // The card is gone after the approve flow.
    expect(
      bot.blocks?.some((b) => b.type === "action_confirmation"),
    ).toBeFalsy();
  });

  it("forwards identity in the decision body when set", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    seedBubbleWithBlock(chat);
    await chat.sendMessage("hello");

    chat.identify({ userId: "u_1", email: "a@b.com" });

    // identify clears the local conversation; re-seed the card.
    seedBubbleWithBlock(chat);
    await chat.sendMessage("hello");

    let captured: { identity?: { userId: string } } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        captured = JSON.parse(String(init?.body ?? "{}"));
        return sseStream([{ event: "done", data: "{}" }]);
      }),
    );

    await chat.cancelAction("ptc_1");
    expect(captured?.identity?.userId).toBe("u_1");
  });

  it("surfaces already_resolved errors and re-fetches history", async () => {
    const chat = new CustomerHeroChat({ chatbotId: "bot_x" });
    seedBubbleWithBlock(chat);
    await chat.sendMessage("hello");

    const historyFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/tool-calls/")) {
        return sseStream([
          {
            event: "error",
            data: JSON.stringify({
              kind: "already_resolved",
              error: "Already resolved",
            }),
          },
        ]);
      }
      if (url.includes("/messages/")) {
        return new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", historyFetch);

    await chat.approveAction("ptc_1");

    expect(chat.getState().error).toBeTruthy();
    // History fetch was called.
    const calledUrls = historyFetch.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("/messages/"))).toBe(true);
  });
});
