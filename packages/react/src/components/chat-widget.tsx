import { useEffect, useRef } from "react";
import type { CustomerHeroChatConfig, IdentifyPayload } from "@customerhero/js";
import { CustomerHeroProvider, useCustomerHeroClient } from "../context";
import { useChat } from "../use-chat";
import { ChatBubble } from "./chat-bubble";
import { ChatWindow } from "./chat-window";

export interface ChatWidgetProps extends CustomerHeroChatConfig {
  /** Pass customer identity data to link conversations to customer records. */
  identity?: IdentifyPayload;
  /**
   * Render the launcher and chat panel as `position: absolute` inside the
   * nearest positioned ancestor instead of fixed to the viewport. Useful for
   * inline demos and previews where the widget should not float over the
   * whole page. The host should wrap `<ChatWidget>` in a `position: relative`
   * container of the size you want; offsets become relative to that
   * container.
   */
  embedded?: boolean;
}

function ChatWidgetInner({
  identity,
  embedded,
}: {
  identity?: IdentifyPayload;
  embedded?: boolean;
}) {
  const client = useCustomerHeroClient();
  const { configLoaded, configError } = useChat();
  const prevIdentityRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const key = identity ? JSON.stringify(identity) : undefined;
    if (key !== prevIdentityRef.current) {
      prevIdentityRef.current = key;
      if (identity) {
        client.identify(identity);
      }
    }
  }, [identity, client]);

  // Hold the launcher until the server config arrives — otherwise it would
  // flash with default branding and reposition once real colors/position
  // load. A failed fetch (e.g. unknown chatbot id) keeps the widget hidden.
  if (!configLoaded || configError) return null;

  return (
    <>
      <ChatBubble embedded={embedded} />
      <ChatWindow embedded={embedded} />
    </>
  );
}

export function ChatWidget({ identity, embedded, ...config }: ChatWidgetProps) {
  return (
    <CustomerHeroProvider {...config}>
      <ChatWidgetInner identity={identity} embedded={embedded} />
    </CustomerHeroProvider>
  );
}
