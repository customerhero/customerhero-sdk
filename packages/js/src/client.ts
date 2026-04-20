import { DEFAULTS } from "./defaults";
import { createTranslate, type TranslateFn } from "./i18n";
import type {
  CustomerHeroChatConfig,
  ResolvedConfig,
  ChatMessage,
  ChatState,
  MessageRating,
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
      const data = await response.json();
      const messages: ChatMessage[] = (data.messages ?? []).map(
        (m: { id?: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as "user" | "bot",
          content: m.content,
        }),
      );
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
    this.setState({
      messages: [...this.state.messages, userMsg],
      isLoading: true,
      error: null,
    });

    const { chatbotId } = this.state.config;
    const apiBase = this.state.config.apiBase;

    try {
      const response = await fetch(`${apiBase}/api/chat/${chatbotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const data = await response.json();
      const botMsg: ChatMessage = {
        id: data.messageId,
        role: "bot",
        content: data.message,
      };

      const conversationId = data.conversationId ?? this.state.conversationId;
      if (conversationId) {
        this.storage?.setItem(`ch_conv_${chatbotId}`, conversationId);
      }

      this.setState({
        messages: [...this.state.messages, botMsg],
        isLoading: false,
        conversationId,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Something went wrong";
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
