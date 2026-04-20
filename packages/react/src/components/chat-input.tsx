import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";

export function ChatInput() {
  const { sendMessage, isLoading, config, t } = useChat();
  const reduced = useReducedMotion();
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    sendMessage(value);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const containerStyle: CSSProperties = {
    padding: "12px 16px",
    borderTop: "1px solid #eee",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    border: "1px solid #e0e0e0",
    borderRadius: 24,
    padding: "10px 16px",
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
    color: config.textColor,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const buttonStyle: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: config.primaryColor,
    border: "none",
    color: "white",
    cursor: isLoading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: isLoading ? 0.5 : 1,
    transition: reduced ? "opacity 0.2s" : "opacity 0.2s, transform 0.15s",
    flexShrink: 0,
    transform: "scale(1)",
  };

  return (
    <div style={containerStyle}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={config.placeholderText}
        style={inputStyle}
        disabled={isLoading}
      />
      <button
        onClick={handleSend}
        disabled={isLoading || !value.trim()}
        style={buttonStyle}
        aria-label={t("send_message")}
        onMouseEnter={(e) => {
          if (!reduced && !isLoading)
            e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          if (!reduced) e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
