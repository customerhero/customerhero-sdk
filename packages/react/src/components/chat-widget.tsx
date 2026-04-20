import { useEffect, useRef } from "react";
import type { CustomerHeroChatConfig, IdentifyPayload } from "@customerhero/js";
import { CustomerHeroProvider, useCustomerHeroClient } from "../context";
import { ChatBubble } from "./chat-bubble";
import { ChatWindow } from "./chat-window";

export interface ChatWidgetProps extends CustomerHeroChatConfig {
  /** Pass customer identity data to link conversations to customer records. */
  identity?: IdentifyPayload;
}

function ChatWidgetInner({ identity }: { identity?: IdentifyPayload }) {
  const client = useCustomerHeroClient();
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
