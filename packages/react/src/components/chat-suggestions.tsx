import type { CSSProperties } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";

export function ChatSuggestions() {
  const { messages, isLoading, config, sendMessage } = useChat();
  const reduced = useReducedMotion();

  const hasUserMessage = messages.some((m) => m.role === "user");
  if (config.suggestedMessages.length === 0 || hasUserMessage || isLoading) {
    return null;
  }

  const containerStyle: CSSProperties = {
    padding: "8px 16px",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  };

  const chipStyle: CSSProperties = {
    background: "none",
    border: "1px solid #e0e0e0",
    borderRadius: 20,
    padding: "7px 14px",
    fontSize: 13,
    color: "#333",
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
            e.currentTarget.style.borderColor = config.primaryColor;
            e.currentTarget.style.background = `${config.primaryColor}08`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e0e0e0";
            e.currentTarget.style.background = "none";
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
