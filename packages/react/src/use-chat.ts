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
  sendMessage: (message: string) => Promise<void>;
  rateMessage: (messageId: string, rating: MessageRating) => Promise<void>;
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
      (message: string) => client.sendMessage(message),
      [client],
    ),
    rateMessage: useCallback(
      (messageId: string, rating: MessageRating) =>
        client.rateMessage(messageId, rating),
      [client],
    ),
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
