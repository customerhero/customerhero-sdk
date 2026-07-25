import type { CSSProperties } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";
import { useEffectiveTheme } from "../use-effective-theme";

export function ChatSuggestions() {
  const { messages, isLoading, config, sendMessage } = useChat();
  const reduced = useReducedMotion();
  const theme = useEffectiveTheme();

  const hasUserMessage = messages.some((m) => m.role === "user");
  if (config.suggestedMessages.length === 0 || hasUserMessage || isLoading) {
    return null;
  }

  // In dark mode the chip border + idle text both get inverted so they read
  // against the dark panel. The hover state still pulls from the primary
  // color so the chip lights up.
  const isDark = theme.scheme === "dark";
  const idleBorder = isDark ? "rgba(255,255,255,0.18)" : "#e0e0e0";

  const containerStyle: CSSProperties = {
    padding: "8px 16px",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    flexShrink: 0,
  };

  const chipStyle: CSSProperties = {
    background: "none",
    border: `1px solid ${idleBorder}`,
    borderRadius: 20,
    padding: "7px 14px",
    fontSize: 13,
    color: theme.text,
    cursor: "pointer",
    textAlign: "left",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    transition: reduced ? "none" : "border-color 0.15s, background 0.15s",
  };

  return (
    <div style={containerStyle}>
      {config.suggestedMessages.map((text) => (
        <button
          key={text}
          style={chipStyle}
          onClick={() => sendMessage(text)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = theme.primary;
            e.currentTarget.style.background = `${theme.primary}14`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = idleBorder;
            e.currentTarget.style.background = "none";
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
