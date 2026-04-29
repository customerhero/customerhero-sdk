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

// Local-only delivery status for user messages. Intentionally narrow so it
// can extend to `delivered` / `read` once the server schema lands without
// churning the public type contract.
export type MessageStatus = "sending" | "sent" | "failed";

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
  /**
   * Local-only delivery status. User messages only — `sending` until the
   * SSE `metadata` event lands, then `sent`. `failed` if the POST never
   * reached the server. Bot messages use `streaming` instead.
   */
  status?: MessageStatus;
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

// ─── Proactive engagement ─────────────────────────────────────────────────
// These types mirror the public widget-config payload returned by
// `GET /api/widget/:chatbotId/config`. The condition tree is opaque to the
// SDK consumer — `triggers.evaluate()` walks it.

export type TriggerConditionNode =
  | { all: TriggerConditionNode[] }
  | { any: TriggerConditionNode[] }
  | TriggerConditionLeaf;

export type TriggerConditionLeaf =
  | {
      kind: "url_path";
      op: "equals" | "contains" | "regex" | "starts_with";
      value: string;
    }
  | {
      kind: "url_query";
      key: string;
      op: "equals" | "contains" | "exists";
      value?: string;
    }
  | { kind: "referrer"; op: "contains" | "equals" | "regex"; value: string }
  | { kind: "time_on_page"; seconds: number }
  | { kind: "scroll_depth"; percent: number }
  | { kind: "exit_intent" }
  | { kind: "device"; op: "equals"; value: "mobile" | "tablet" | "desktop" }
  | { kind: "browser_language"; op: "in"; values: string[] }
  | {
      kind: "visitor_trait";
      key: string;
      op: "equals" | "exists" | "gt" | "lt";
      value?: string | number | boolean;
    }
  | { kind: "return_visit"; op: "gte" | "eq"; count: number };

export type TriggerAction =
  | { kind: "open_widget" }
  | { kind: "send_message"; message: string }
  | { kind: "show_form" }
  | { kind: "open_with_prefill"; prefill: string };

export type TriggerFrequency = "once_ever" | "once_per_session" | "every_time";

export interface TriggerDefinition {
  id: string;
  priority: number;
  conditions: TriggerConditionNode;
  action: TriggerAction;
  frequency: TriggerFrequency;
}

export type PreChatFieldKind =
  | "name"
  | "email"
  | "phone"
  | "text"
  | "textarea"
  | "select"
  | "consent";

export type PreChatField =
  | { kind: "name"; required?: boolean; label?: string }
  | { kind: "email"; required?: boolean; label?: string; validateMx?: boolean }
  | { kind: "phone"; required?: boolean; label?: string }
  | {
      kind: "text";
      key: string;
      label: string;
      required?: boolean;
      maxLength?: number;
    }
  | {
      kind: "textarea";
      key: string;
      label: string;
      required?: boolean;
      maxLength?: number;
    }
  | {
      kind: "select";
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      required?: boolean;
    }
  | {
      kind: "consent";
      key: string;
      label: string;
      url?: string;
      required: true;
    };

export interface PreChatFormConfig {
  fields: PreChatField[];
  title?: string | null;
  description?: string | null;
  submitLabel: string;
  /** When true, an identified visitor (CustomerHero.identify already called)
   *  bypasses the form. */
  skipForIdentified: boolean;
}

export interface PreChatSubmission {
  name?: string;
  email?: string;
  phone?: string;
  /** Keyed answers from text/textarea/select/consent fields. */
  properties?: Record<string, string | number | boolean>;
}

export interface ConsentSettings {
  /** When true, all condition kinds are evaluated. When false (default), only
   *  direct launcher clicks fire — URL/time/scroll/exit-intent/trait
   *  conditions stay dormant. */
  analytics: boolean;
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
  /** Triggers loaded from the server config (active + in-window). */
  triggers: TriggerDefinition[];
  /** Pre-chat form configuration, if any. */
  preChatForm: PreChatFormConfig | null;
  /**
   * True when the pre-chat form must be shown before the next chat turn.
   * Flipped by trigger actions, by the first sendMessage when a form is
   * configured and not yet submitted, and cleared on submit.
   */
  preChatFormVisible: boolean;
  /** Captured pre-chat submission, sent on the first chat call. */
  preChatSubmission: PreChatSubmission | null;
  /** Per-visitor consent. Until set explicitly, only direct launcher clicks
   *  trigger; behavioral conditions stay dormant. */
  consent: ConsentSettings;
  /** ID of the trigger attributed to the next conversation start, if any. */
  pendingTriggerId: string | null;
  /** When set, the host should preload this text into the input. Cleared
   *  once the host consumes it (or when the conversation starts). */
  pendingPrefill: string | null;
}
