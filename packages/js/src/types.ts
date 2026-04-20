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
}

export interface ChatMessage {
  /** Message ID from the API (only present for bot messages) */
  id?: string;
  role: "user" | "bot";
  content: string;
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
}
