// Internal subpath used by the dashboard preview pane to render the real
// widget chrome against a host-supplied config without hitting the API. Not
// part of the public SDK surface — third-party code should not import from
// `@customerhero/react/preview`.

import { useEffect, type CSSProperties } from "react";
import type { CustomerHeroChatConfig } from "@customerhero/js";
import { CustomerHeroProvider, useCustomerHeroClient } from "./context";
import { ChatBubble } from "./components/chat-bubble";
import { ChatWindow } from "./components/chat-window";

export interface PreviewWidgetProps extends CustomerHeroChatConfig {
  /**
   * Optional wrapper styles. The component already wraps its children in a
   * `position: relative` block; this lets the host control width/height/
   * background of the preview canvas.
   */
  style?: CSSProperties;
  /** Optional className on the outer wrapper. */
  className?: string;
}

function PreviewBootstrap() {
  const client = useCustomerHeroClient();
  useEffect(() => {
    client.__seedForPreview();
  }, [client]);
  return null;
}

const wrapperStyleBase: CSSProperties = {
  position: "relative",
  overflow: "hidden",
};

/**
 * Render the chat widget for visual preview only — no API calls, no SSE,
 * no localStorage writes, input disabled. The window auto-opens. The bubble
 * + window are positioned `absolute` inside the wrapper element.
 *
 * The host passes the same config shape as `<ChatWidget>`, plus an optional
 * `colorScheme` (`light` / `dark` / `auto`) to drive the visitor-side dark
 * mode toggle independently of the chatbot's own light/dark palettes.
 */
export function PreviewWidget({
  style,
  className,
  ...config
}: PreviewWidgetProps) {
  // Re-mount the provider whenever the input config changes so a fresh
  // CustomerHeroChat instance picks up the new resolved palette / size /
  // corners. Cheap because preview state is short-lived.
  const remountKey = JSON.stringify(config);
  return (
    <div
      className={className}
      style={{ ...wrapperStyleBase, ...style }}
      data-customerhero-preview="true"
    >
      <CustomerHeroProvider key={remountKey} disableAutoFetch {...config}>
        <PreviewBootstrap />
        <ChatBubble embedded />
        <ChatWindow embedded />
      </CustomerHeroProvider>
    </div>
  );
}
