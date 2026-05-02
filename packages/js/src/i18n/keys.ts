// Source of truth for the translation key surface. Adding a key here forces
// every locale catalog under ./locales to provide it (each catalog is typed
// `Translations`, which is `Record<TranslationKey, string>` — TypeScript
// fails the build if any locale is missing a key).

export type TranslationKey =
  | "online"
  | "typing"
  | "unable_to_load"
  | "powered_by"
  | "new_conversation"
  | "open_chat"
  | "close_chat"
  | "send_message"
  | "helpful"
  | "not_helpful"
  | "menu"
  | "action_approve"
  | "action_cancel"
  | "action_what_will_happen"
  | "action_already_resolved"
  | "action_failed"
  | "status_sending"
  | "status_sent"
  | "status_failed"
  | "screenshot_capture"
  | "attachment_remove"
  | "attach_menu_open"
  | "attach_photo"
  | "drop_files_here"
  | "attachment_unsupported_type";

export type Translations = Record<TranslationKey, string>;
