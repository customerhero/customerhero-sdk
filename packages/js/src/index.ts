export { CustomerHeroChat } from "./client";
export { DEFAULTS, SIZE_PRESETS, CORNER_RADIUS } from "./defaults";
export {
  resolveScheme,
  effectiveColors,
  sizePreset,
  panelRadius,
  type EffectiveScheme,
} from "./theme";
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
  MessageAttachment,
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
  IncidentBanner,
} from "./types";
export { evaluate, pickFire, type VisitorContext } from "./triggers";
export {
  startTriggersRuntime,
  type TriggersRuntimeHandle,
} from "./triggers-runtime";
