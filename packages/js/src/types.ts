export interface CustomerHeroChatConfig {
  /** The chatbot ID to connect to */
  chatbotId: string;
  /** API base URL (defaults to "https://customerhero.app") */
  apiBase?: string;
  /** Override primary/accent color */
  primaryColor?: string;
  /** Override chat window background color */
  backgroundColor?: string;
  /** Override text color */
  textColor?: string;
  /** Widget position */
  position?: "bottom-right" | "bottom-left";
  /** Override input placeholder text */
  placeholderText?: string;
  /** Override welcome message */
  welcomeMessage?: string;
  /** Override header title */
  title?: string;
  /** Override avatar URL */
  avatarUrl?: string;
  /** Widget locale (e.g. "en", "es"). Auto-detected from browser if omitted. */
  locale?: string;
  /** Predefined quick-reply options shown before the user sends a message */
  suggestedMessages?: string[];
}

import type { StringOverrides, SupportedLocale } from "./i18n";

export interface ResolvedConfig {
  chatbotId: string;
  apiBase: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  position: "bottom-right" | "bottom-left";
  placeholderText: string;
  welcomeMessage: string;
  title: string;
  avatarUrl?: string;
  suggestedMessages: string[];
  /** Per-chatbot overrides for any translation key, optionally per-locale. */
  stringOverrides?: StringOverrides;
}

// Source citation emitted inline in bot replies as `[1]`, `[2]` markers and
// attached to the message as structured data so the renderer can turn the
// markers into clickable links.
export interface MessageSource {
  index: number;
  title: string;
  url?: string;
  dataSourceId: string;
  heading?: string;
}

// Structured part of a bot reply beyond the plain-text `content`. Rendered
// alongside the bubble. The union is open-ended — unknown types should be
// ignored by older clients.
export type QuickRepliesBlock = {
  type: "quick_replies";
  options: string[];
};

// Inline approve/cancel card the widget renders when the bot proposes a
// confirm-required action mid-turn. Server-generated; the widget routes
// the decision through `approveAction` / `cancelAction` on the client.
export type ActionConfirmationBlock = {
  type: "action_confirmation";
  pendingToolCallId: string;
  actionName: string;
  title: string;
  summary: string;
  approveHref: string;
  cancelHref: string;
};

export type MessageBlock = QuickRepliesBlock | ActionConfirmationBlock;

export interface ChatMessage {
  /** Message ID from the API (only present for bot messages) */
  id?: string;
  role: "user" | "bot";
  content: string;
  /** Source citations referenced inline with `[n]` markers. Bot only. */
  sources?: MessageSource[];
  /** Structured blocks (quick-reply chips, etc.) rendered with the bubble. */
  blocks?: MessageBlock[];
  /**
   * Follow-up questions the customer might plausibly ask next. Rendered as
   * tappable chips under the most recent bot message only.
   */
  suggestions?: string[];
  /** True while this message is still receiving streaming tokens. */
  streaming?: boolean;
}

export type MessageRating = "positive" | "negative";

export interface IdentifyPayload {
  /** Stable unique user ID from your system (required) */
  userId: string;
  /** User's email address */
  email?: string;
  /** User's display name */
  name?: string;
  /** User's phone number */
  phone?: string;
  /** User's company name */
  company?: string;
  /** HMAC-SHA256 hash for identity verification */
  userHash?: string;
  /** Additional custom properties (string, number, or boolean values) */
  [key: string]: unknown;
}

export interface IdentityData {
  userId: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  userHash?: string;
  customProperties?: Record<string, string | number | boolean>;
}

export interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  conversationId: string | null;
  config: ResolvedConfig;
  configLoaded: boolean;
  configError: string | null;
  error: string | null;
  identity: IdentityData | null;
  /** Active locale (one of `SUPPORTED_LOCALES`). */
  locale: SupportedLocale;
  /** True when the active locale is right-to-left. */
  isRtl: boolean;
}
