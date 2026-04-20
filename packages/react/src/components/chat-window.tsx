import { useEffect, useState, type CSSProperties } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatSuggestions } from "./chat-suggestions";
import { ChatInput } from "./chat-input";

function ConfigError({ message, title }: { message: string; title: string }) {
  const errorStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    textAlign: "center",
    gap: 8,
  };

  return (
    <div style={errorStyle}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#999"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={{ fontSize: 14, fontWeight: 500, color: "#333", margin: 0 }}>
        {title}
      </p>
      <p style={{ fontSize: 12, color: "#999", margin: 0 }}>{message}</p>
    </div>
  );
}

export function ChatWindow() {
  const { isOpen, config, configError, t } = useChat();
  const reduced = useReducedMotion();
  // Track render visibility separately to allow exit animation
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Next frame: trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      if (reduced) {
        setShouldRender(false);
      } else {
        // Wait for exit animation
        const timer = setTimeout(() => setShouldRender(false), 250);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, reduced]);

  if (!shouldRender) return null;

  const style: CSSProperties = {
    position: "fixed",
    bottom: 90,
    [config.position === "bottom-left" ? "left" : "right"]: 20,
    width: 380,
    maxWidth: "calc(100vw - 40px)",
    height: 520,
    maxHeight: "calc(100vh - 120px)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
    zIndex: 99999,
    background: config.backgroundColor,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translateY(0) scale(1)"
      : "translateY(16px) scale(0.97)",
    transition: reduced ? "none" : "opacity 0.25s ease, transform 0.25s ease",
  };

  const poweredStyle: CSSProperties = {
    textAlign: "center",
    padding: 6,
    fontSize: 10,
    color: "#aaa",
  };

  const linkStyle: CSSProperties = {
    color: "#888",
    textDecoration: "underline",
    textUnderlineOffset: 2,
  };

  return (
    <div style={style}>
      <ChatHeader />
      {configError ? (
        <ConfigError title={t("unable_to_load")} message={configError} />
      ) : (
        <>
          <ChatMessages />
          <ChatSuggestions />
          <ChatInput />
        </>
      )}
      <div style={poweredStyle}>
        {t("powered_by")}{" "}
        <a
          href="https://customerhero.app"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          CustomerHero
        </a>
      </div>
    </div>
  );
}
