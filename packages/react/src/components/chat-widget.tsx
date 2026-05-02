import { useEffect, useRef } from "react";
import type { CustomerHeroChatConfig, IdentifyPayload } from "@customerhero/js";
import { CustomerHeroProvider, useCustomerHeroClient } from "../context";
import { useChat } from "../use-chat";
import { ChatBubble } from "./chat-bubble";
import { ChatWindow } from "./chat-window";

export interface ChatWidgetProps extends CustomerHeroChatConfig {
  /** Pass customer identity data to link conversations to customer records. */
  identity?: IdentifyPayload;
}

function ChatWidgetInner({ identity }: { identity?: IdentifyPayload }) {
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
      <ChatBubble />
      <ChatWindow />
    </>
  );
}

export function ChatWidget({ identity, ...config }: ChatWidgetProps) {
  return (
    <CustomerHeroProvider {...config}>
      <ChatWidgetInner identity={identity} />
    </CustomerHeroProvider>
  );
}
