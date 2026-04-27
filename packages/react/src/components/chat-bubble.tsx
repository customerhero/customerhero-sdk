import { useEffect, useState, type CSSProperties } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";

export function ChatBubble() {
  const { toggle, config, t, isRtl } = useChat();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const visible = mounted;

  // Flip the launcher corner for RTL locales — users of those languages
  // expect interactive chrome to mirror text direction.
  const effectivePosition = isRtl
    ? config.position === "bottom-right"
      ? "bottom-left"
      : "bottom-right"
    : config.position;

  const style: CSSProperties = {
    position: "fixed",
    bottom: 20,
    [effectivePosition === "bottom-left" ? "left" : "right"]: 20,
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: config.primaryColor,
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    zIndex: 99999,
    border: "none",
    padding: 0,
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.6)",
    transition: reduced ? "none" : "opacity 0.25s ease, transform 0.25s ease",
    pointerEvents: visible ? "auto" : "none",
  };

  return (
    <button
      onClick={toggle}
      style={style}
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={t("open_chat")}
      onMouseEnter={(e) => {
        if (!reduced) e.currentTarget.style.transform = "scale(1.1)";
      }}
      onMouseLeave={(e) => {
        if (!reduced) e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
