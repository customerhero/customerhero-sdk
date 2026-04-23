import { DEFAULTS } from "./defaults";
import { createTranslate, type TranslateFn } from "./i18n";
import { readSSEStream } from "./sse";
import type {
  CustomerHeroChatConfig,
  ResolvedConfig,
  ChatMessage,
  ChatState,
  MessageRating,
  MessageSource,
  MessageBlock,
  IdentifyPayload,
  IdentityData,
} from "./types";

type Listener = (state: ChatState) => void;

function resolveConfig(
  userConfig: CustomerHeroChatConfig,
  fetched?: Partial<ResolvedConfig>,
): ResolvedConfig {
  return {
    chatbotId: userConfig.chatbotId,
    apiBase: userConfig.apiBase ?? DEFAULTS.apiBase,
    primaryColor:
      userConfig.primaryColor ?? fetched?.primaryColor ?? DEFAULTS.primaryColor,
    backgroundColor:
      userConfig.backgroundColor ??
      fetched?.backgroundColor ??
      DEFAULTS.backgroundColor,
    textColor: userConfig.textColor ?? fetched?.textColor ?? DEFAULTS.textColor,
    position: userConfig.position ?? fetched?.position ?? DEFAULTS.position,
    placeholderText:
      userConfig.placeholderText ??
      fetched?.placeholderText ??
      DEFAULTS.placeholderText,
    welcomeMessage:
      userConfig.welcomeMessage ??
      fetched?.welcomeMessage ??
      DEFAULTS.welcomeMessage,
    title: userConfig.title ?? fetched?.title ?? DEFAULTS.title,
    avatarUrl: userConfig.avatarUrl ?? fetched?.avatarUrl,
    suggestedMessages:
      userConfig.suggestedMessages ?? fetched?.suggestedMessages ?? [],
  };
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class CustomerHeroChat {
  private state: ChatState;
  private listeners = new Set<Listener>();
  private storage: Storage | null;
  private userConfig: CustomerHeroChatConfig;
  private identityData: IdentityData | null = null;
  readonly t: TranslateFn;

  constructor(config: CustomerHeroChatConfig) {
    this.userConfig = config;
    this.storage = getStorage();
    this.t = createTranslate(config.locale);

    const resolved = resolveConfig(config);
    const storedConvId = this.storage?.getItem(`ch_conv_${config.chatbotId}`);

    this.state = {
      messages: [],
      isOpen: false,
      isLoading: false,
      conversationId: storedConvId ?? null,
      config: resolved,
      configLoaded: false,
      configError: null,
      error: null,
      identity: null,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ChatState {
    return this.state;
  }

  private setState(partial: Partial<ChatState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  // Mutate the last message in place and notify. Used during streaming so
  // listeners see tokens land without allocating a new messages array per
  // token. The array itself is still replaced so consumers using
  // structural equality (React's useSyncExternalStore) see a new reference.
  private patchLastMessage(patch: Partial<ChatMessage>): void {
    const { messages } = this.state;
    if (messages.length === 0) return;
    const next = messages.slice();
    const last = next[next.length - 1];
    next[next.length - 1] = { ...last, ...patch };
    this.setState({ messages: next });
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  async fetchConfig(): Promise<void> {
    const { chatbotId } = this.userConfig;
    const apiBase = this.userConfig.apiBase ?? DEFAULTS.apiBase;

    try {
      const response = await fetch(`${apiBase}/api/widget/${chatbotId}/config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }
      const fetched = await response.json();
      const resolved = resolveConfig(this.userConfig, fetched);
      this.setState({ config: resolved, configLoaded: true });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to load widget config";
      console.error("CustomerHero: Failed to fetch widget config", error);
      this.setState({
        configLoaded: true,
        configError: errorMsg,
      });
      return;
    }

    // Load previous conversation history if we have a stored conversationId
    if (this.state.conversationId) {
      await this.loadHistory();
    }
  }

  private async loadHistory(): Promise<void> {
    const { chatbotId, apiBase } = this.state.config;
    const { conversationId } = this.state;
    if (!conversationId) return;

    try {
      const response = await fetch(
        `${apiBase}/api/chat/${chatbotId}/messages/${conversationId}`,
      );
      if (!response.ok) {
        // Conversation may have been deleted — clear it and start fresh
        this.storage?.removeItem(`ch_conv_${chatbotId}`);
        this.setState({ conversationId: null });
        return;
      }
      const data = (await response.json()) as {
        messages?: Array<{
          id?: string;
          role: string;
          content: string;
          sources?: MessageSource[];
          blocks?: MessageBlock[];
          suggestions?: string[];
        }>;
      };
      const raw = data.messages ?? [];
      const messages: ChatMessage[] = raw.map((m) => ({
        id: m.id,
        role: m.role as "user" | "bot",
        content: m.content,
        ...(m.sources ? { sources: m.sources } : {}),
        ...(m.blocks ? { blocks: m.blocks } : {}),
        ...(m.suggestions ? { suggestions: m.suggestions } : {}),
      }));

      // Only keep follow-up suggestions on the most recent bot message — older
      // suggestions are stale once the conversation has moved on.
      const lastBotIndex = findLastIndex(
        messages,
        (m) => m.role === "bot" && !!m.suggestions?.length,
      );
      for (let i = 0; i < messages.length; i++) {
        if (i !== lastBotIndex && messages[i].suggestions) {
          const { suggestions: _s, ...rest } = messages[i];
          void _s;
          messages[i] = rest;
        }
      }

      if (messages.length > 0) {
        this.setState({ messages });
      }
    } catch {
      // Silently fail — user can still chat, just won't see history
    }
  }

  async sendMessage(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed || this.state.isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    // Drop any stale follow-up suggestions from the previous bot turn — the
    // customer just sent a new message, the old chips no longer apply.
    const cleanedHistory = this.state.messages.map((m) =>
      m.suggestions ? stripSuggestions(m) : m,
    );
    this.setState({
      messages: [...cleanedHistory, userMsg],
      isLoading: true,
      error: null,
    });

    const { chatbotId, apiBase } = this.state.config;
    let botMessageCreated = false;

    try {
      const response = await fetch(`${apiBase}/api/chat/${chatbotId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: trimmed,
          ...(this.state.conversationId
            ? { conversationId: this.state.conversationId }
            : {}),
          ...(this.identityData ? { identity: this.identityData } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMsg =
          (data as { error?: string } | null)?.error ??
          `Request failed: ${response.status}`;
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error("Empty response body");
      }

      let fullContent = "";
      let messageId: string | undefined;

      for await (const evt of readSSEStream(response.body)) {
        switch (evt.event) {
          case "metadata": {
            const meta = safeParse<{
              conversationId?: string;
              messageId?: string;
            }>(evt.data);
            if (meta?.conversationId) {
              this.storage?.setItem(
                `ch_conv_${chatbotId}`,
                meta.conversationId,
              );
              this.setState({ conversationId: meta.conversationId });
            }
            if (meta?.messageId) {
              messageId = meta.messageId;
            }
            break;
          }
          case "token": {
            const tok = safeParse<{ text?: string }>(evt.data);
            const text = tok?.text ?? "";
            fullContent += text;
            if (!botMessageCreated) {
              const botMsg: ChatMessage = {
                id: messageId,
                role: "bot",
                content: fullContent,
                streaming: true,
              };
              this.setState({
                messages: [...this.state.messages, botMsg],
              });
              botMessageCreated = true;
            } else {
              this.patchLastMessage({ content: fullContent });
            }
            break;
          }
          case "sources": {
            const payload = safeParse<{ sources?: MessageSource[] }>(evt.data);
            if (payload?.sources?.length && botMessageCreated) {
              this.patchLastMessage({ sources: payload.sources });
            }
            break;
          }
          case "block": {
            const payload = safeParse<{ block?: MessageBlock }>(evt.data);
            if (payload?.block && botMessageCreated) {
              const existing = this.state.messages.at(-1)?.blocks ?? [];
              this.patchLastMessage({
                blocks: [...existing, payload.block],
              });
            }
            break;
          }
          case "suggestions": {
            const payload = safeParse<{ suggestions?: string[] }>(evt.data);
            if (payload?.suggestions?.length && botMessageCreated) {
              this.patchLastMessage({ suggestions: payload.suggestions });
            }
            break;
          }
          case "done": {
            if (botMessageCreated) {
              this.patchLastMessage({
                id: messageId,
                streaming: false,
              });
            }
            break;
          }
          case "error": {
            const payload = safeParse<{ error?: string }>(evt.data);
            throw new Error(payload?.error ?? "Stream failed");
          }
        }
      }

      // If we finished the stream without any tokens (e.g. manual response
      // mode), surface a neutral empty state rather than a ghost bubble.
      if (!botMessageCreated && !fullContent) {
        // Nothing to render — the server is deferring to a human agent.
      }

      this.setState({ isLoading: false });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Something went wrong";
      // If a partial bot message was rendered, drop its streaming flag so it
      // stops looking like it's still loading.
      if (botMessageCreated) {
        this.patchLastMessage({ streaming: false });
      }
      this.setState({
        isLoading: false,
        error: errorMsg,
      });
    }
  }

  async rateMessage(messageId: string, rating: MessageRating): Promise<void> {
    const { chatbotId, apiBase } = this.state.config;
    const { conversationId } = this.state;
    if (!conversationId) return;

    try {
      await fetch(`${apiBase}/api/chat/${chatbotId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messageId, rating }),
      });
    } catch (error) {
      console.error("CustomerHero: Failed to rate message", error);
    }
  }

  toggle(): void {
    const willOpen = !this.state.isOpen;
    if (
      willOpen &&
      this.state.messages.length === 0 &&
      !this.state.conversationId &&
      this.state.config.welcomeMessage
    ) {
      this.setState({
        isOpen: true,
        messages: [{ role: "bot", content: this.state.config.welcomeMessage }],
      });
    } else {
      this.setState({ isOpen: willOpen });
    }
  }

  open(): void {
    if (!this.state.isOpen) this.toggle();
  }

  close(): void {
    if (this.state.isOpen) this.setState({ isOpen: false });
  }

  reset(): void {
    const { chatbotId, welcomeMessage } = this.state.config;
    this.storage?.removeItem(`ch_conv_${chatbotId}`);
    this.setState({
      messages: welcomeMessage
        ? [{ role: "bot", content: welcomeMessage }]
        : [],
      conversationId: null,
      isLoading: false,
      error: null,
    });
  }

  identify(payload: IdentifyPayload): void {
    const { userId, email, name, phone, company, userHash, ...rest } = payload;
    const customProperties: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        customProperties[k] = v;
      }
    }
    this.identityData = {
      userId,
      email,
      name,
      phone,
      company,
      userHash,
      customProperties:
        Object.keys(customProperties).length > 0 ? customProperties : undefined,
    };
    // When identity changes, clear old conversation to start fresh
    const { chatbotId, welcomeMessage } = this.state.config;
    this.storage?.removeItem(`ch_conv_${chatbotId}`);
    this.setState({
      messages: welcomeMessage
        ? [{ role: "bot", content: welcomeMessage }]
        : [],
      conversationId: null,
      isLoading: false,
      error: null,
      identity: this.identityData,
    });
  }
}

function safeParse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

function stripSuggestions(message: ChatMessage): ChatMessage {
  const { suggestions: _s, ...rest } = message;
  void _s;
  return rest;
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
