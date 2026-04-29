import { useCallback, useSyncExternalStore } from "react";
import type {
  ChatState,
  MessageRating,
  TranslateFn,
  IdentifyPayload,
  ConsentSettings,
  PreChatSubmission,
} from "@customerhero/js";
import { useCustomerHeroClient } from "./context";

export interface UseChatReturn extends ChatState {
  t: TranslateFn;
  sendMessage: (
    message: string,
    options?: { attachmentTokens?: string[] },
  ) => Promise<void>;
  rateMessage: (messageId: string, rating: MessageRating) => Promise<void>;
  approveAction: (pendingId: string) => Promise<void>;
  cancelAction: (pendingId: string) => Promise<void>;
  uploadAttachment: (
    blob: Blob,
    options?: { filename?: string },
  ) => Promise<{
    attachmentToken: string;
    previewUrl: string;
    expiresAt: string;
  }>;
  setLocale: (tag: string) => void;
  toggle: () => void;
  open: () => void;
  close: () => void;
  reset: () => void;
  identify: (payload: IdentifyPayload) => void;
  setConsent: (consent: Partial<ConsentSettings>) => void;
  setTraits: (traits: Record<string, string | number | boolean>) => void;
  submitPreChatForm: (submission: PreChatSubmission) => Promise<void>;
  cancelPreChatForm: () => void;
  fireTrigger: (triggerId: string) => void;
  consumePendingPrefill: () => string | null;
}

export function useChat(): UseChatReturn {
  const client = useCustomerHeroClient();

  const state = useSyncExternalStore(
    useCallback((cb: () => void) => client.subscribe(cb), [client]),
    () => client.getState(),
    () => client.getState(),
  );

  return {
    ...state,
    t: client.t,
    sendMessage: useCallback(
      (message: string, options?: { attachmentTokens?: string[] }) =>
        client.sendMessage(message, options),
      [client],
    ),
    uploadAttachment: useCallback(
      (blob: Blob, options?: { filename?: string }) =>
        client.uploadAttachment(blob, options),
      [client],
    ),
    rateMessage: useCallback(
      (messageId: string, rating: MessageRating) =>
        client.rateMessage(messageId, rating),
      [client],
    ),
    approveAction: useCallback(
      (pendingId: string) => client.approveAction(pendingId),
      [client],
    ),
    cancelAction: useCallback(
      (pendingId: string) => client.cancelAction(pendingId),
      [client],
    ),
    setLocale: useCallback((tag: string) => client.setLocale(tag), [client]),
    toggle: useCallback(() => client.toggle(), [client]),
    open: useCallback(() => client.open(), [client]),
    close: useCallback(() => client.close(), [client]),
    reset: useCallback(() => client.reset(), [client]),
    identify: useCallback(
      (payload: IdentifyPayload) => client.identify(payload),
      [client],
    ),
    setConsent: useCallback(
      (consent: Partial<ConsentSettings>) => client.setConsent(consent),
      [client],
    ),
    setTraits: useCallback(
      (traits: Record<string, string | number | boolean>) =>
        client.setTraits(traits),
      [client],
    ),
    submitPreChatForm: useCallback(
      (submission: PreChatSubmission) => client.submitPreChatForm(submission),
      [client],
    ),
    cancelPreChatForm: useCallback(() => client.cancelPreChatForm(), [client]),
    fireTrigger: useCallback(
      (triggerId: string) => client.fireTrigger(triggerId),
      [client],
    ),
    consumePendingPrefill: useCallback(
      () => client.consumePendingPrefill(),
      [client],
    ),
  };
}
