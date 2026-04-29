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
export {
  captureScreenshot,
  canCaptureScreenshot,
  ScreenshotCancelled,
  ScreenshotUnavailable,
} from "./screenshot";
export type {
  CustomerHeroChatConfig,
  ResolvedConfig,
  ChatMessage,
  ChatState,
  MessageRating,
  MessageSource,
  MessageBlock,
  MessageStatus,
  QuickRepliesBlock,
  ActionConfirmationBlock,
  IdentifyPayload,
  IdentityData,
  TriggerDefinition,
  TriggerConditionNode,
  TriggerConditionLeaf,
  TriggerAction,
  TriggerFrequency,
  PreChatField,
  PreChatFieldKind,
  PreChatFormConfig,
  PreChatSubmission,
  ConsentSettings,
} from "./types";
export { evaluate, pickFire, type VisitorContext } from "./triggers";
export {
  startTriggersRuntime,
  type TriggersRuntimeHandle,
} from "./triggers-runtime";
