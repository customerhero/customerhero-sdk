// Internal subpath used by the dashboard preview pane to render the real
// widget chrome against a host-supplied config without hitting the API. Not
// part of the public SDK surface — third-party code should not import from
// `@customerhero/react/preview`.

import { useEffect, useMemo, type CSSProperties } from "react";
import type { CustomerHeroChatConfig, IncidentBanner } from "@customerhero/js";
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
  /**
   * Render the chatbot's incident banner inside the preview chat window.
   * `null` (or omitted) hides the banner. The banner is sanitized client-side
   * so dashboard-side typos in fields like `link.url` don't crash the preview.
   */
  banner?: IncidentBanner | null;
}

function PreviewBootstrap({
  config,
  banner,
}: {
  config: CustomerHeroChatConfig;
  banner: IncidentBanner | null | undefined;
}) {
  const client = useCustomerHeroClient();

  // Seed once on mount with the initial config (animation fires here).
  useEffect(() => {
    client.__seedForPreview(config, { banner: banner ?? null });
    // Intentional: only on mount. Subsequent config changes flow through the
    // effect below, which updates the resolved config in place WITHOUT
    // toggling isOpen — so the open animation does not re-fire on every
    // keystroke in the dashboard form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Re-resolve whenever any config or banner field changes. Stringify on the
  // dep so nested objects (launcher, offset, banner.link) are deep-compared
  // cheaply.
  const configKey = JSON.stringify(config);
  const bannerKey = JSON.stringify(banner ?? null);
  useEffect(() => {
    client.__seedForPreview(config, { banner: banner ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, configKey, bannerKey]);

  return null;
}

const wrapperStyleBase: CSSProperties = {
  position: "relative",
  overflow: "hidden",
};

/**
 * Render the chat widget for visual preview only — no API calls, no SSE,
 * no localStorage writes, input disabled. The window auto-opens. The bubble
 * and window are positioned `absolute` inside the wrapper element.
 *
 * The host passes the same config shape as `<ChatWidget>`, plus an optional
 * `colorScheme` (`light` / `dark` / `auto`) to drive the visitor-side dark
 * mode toggle independently of the chatbot's own light/dark palettes.
 */
export function PreviewWidget({
  style,
  className,
  banner,
  ...config
}: PreviewWidgetProps) {
  // Snapshot the initial config so the provider's first mount uses it. Later
  // updates flow through PreviewBootstrap's effect; the provider itself is
  // never re-mounted, which keeps isOpen=true sticky and avoids re-firing
  // the open animation on every prop change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialConfig = useMemo(() => config, []);
  return (
    <div
      className={className}
      style={{ ...wrapperStyleBase, ...style }}
      data-customerhero-preview="true"
    >
      <CustomerHeroProvider disableAutoFetch {...initialConfig}>
        <PreviewBootstrap config={config} banner={banner} />
        <ChatBubble embedded />
        <ChatWindow embedded />
      </CustomerHeroProvider>
    </div>
  );
}
