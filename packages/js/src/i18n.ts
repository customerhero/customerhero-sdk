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
  | "action_failed";

type Translations = Record<TranslationKey, string>;

const en: Translations = {
  online: "Online",
  typing: "Typing...",
  unable_to_load: "Unable to load chat",
  powered_by: "Powered by",
  new_conversation: "New conversation",
  open_chat: "Open chat",
  close_chat: "Close chat",
  send_message: "Send message",
  helpful: "Helpful",
  not_helpful: "Not helpful",
  menu: "Menu",
  action_approve: "Approve",
  action_cancel: "Cancel",
  action_what_will_happen: "What will happen?",
  action_already_resolved: "This action has already been resolved.",
  action_failed: "Couldn't complete that action. Please try again.",
};

const es: Translations = {
  online: "En línea",
  typing: "Escribiendo...",
  unable_to_load: "No se pudo cargar el chat",
  powered_by: "Desarrollado por",
  new_conversation: "Nueva conversación",
  open_chat: "Abrir chat",
  close_chat: "Cerrar chat",
  send_message: "Enviar mensaje",
  helpful: "Útil",
  not_helpful: "No útil",
  menu: "Menú",
  action_approve: "Aprobar",
  action_cancel: "Cancelar",
  action_what_will_happen: "¿Qué pasará?",
  action_already_resolved: "Esta acción ya se ha resuelto.",
  action_failed: "No se pudo completar la acción. Inténtalo de nuevo.",
};

const locales: Record<string, Translations> = { en, es };

export type TranslateFn = (key: TranslationKey) => string;

export function createTranslate(locale?: string): TranslateFn {
  const resolved = resolveLocale(locale);
  const translations = locales[resolved] ?? en;
  return (key: TranslationKey) => translations[key] ?? en[key] ?? key;
}

function resolveLocale(locale?: string): string {
  if (locale) {
    const base = locale.split("-")[0].toLowerCase();
    if (locales[base]) return base;
  }
  // Auto-detect from browser
  if (typeof navigator !== "undefined" && navigator.language) {
    const base = navigator.language.split("-")[0].toLowerCase();
    if (locales[base]) return base;
  }
  return "en";
}
