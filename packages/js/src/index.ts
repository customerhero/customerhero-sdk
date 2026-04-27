export { CustomerHeroChat } from "./client";
export { DEFAULTS } from "./defaults";
export {
  SUPPORTED_LOCALES,
  isRtlLocale,
  resolveLocale,
  detectLocale,
  createTranslator,
} from "./i18n";
export type {
  TranslationKey,
  TranslateFn,
  Translations,
  SupportedLocale,
  StringOverrides,
} from "./i18n";
export type {
  CustomerHeroChatConfig,
  ResolvedConfig,
  ChatMessage,
  ChatState,
  MessageRating,
  MessageSource,
  MessageBlock,
  QuickRepliesBlock,
  ActionConfirmationBlock,
  IdentifyPayload,
  IdentityData,
} from "./types";
