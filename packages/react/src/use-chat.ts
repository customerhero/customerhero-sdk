import { useCallback, useSyncExternalStore } from "react";
import type {
  ChatState,
  MessageRating,
  TranslateFn,
  IdentifyPayload,
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
  };
}
