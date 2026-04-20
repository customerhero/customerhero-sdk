import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";

export function ChatHeader() {
  const { config, close, reset, t } = useChat();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const headerStyle: CSSProperties = {
    background: config.primaryColor,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
  };

  const avatarStyle: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: "white",
    margin: 0,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    margin: 0,
  };

  const headerButtonStyle: CSSProperties = {
    background: "none",
    border: "none",
    color: "white",
    cursor: "pointer",
    opacity: 0.7,
    padding: 4,
  };

  const menuStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 4,
    background: "white",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    minWidth: 180,
    overflow: "hidden",
    zIndex: 10,
    transformOrigin: "top right",
    animation: reduced ? "none" : "ch-menu-in 0.15s ease",
  };

  const menuItemStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 14px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#333",
    textAlign: "left",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  return (
    <div style={headerStyle}>
      <div style={avatarStyle}>
        {config.avatarUrl ? (
          <img
            src={config.avatarUrl}
            alt=""
            style={{ width: 36, height: 36, borderRadius: "50%" }}
          />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={titleStyle}>{config.title}</h3>
        <p style={subtitleStyle}>{t("online")}</p>
      </div>
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={headerButtonStyle}
          aria-label={t("menu")}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.7";
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
        {menuOpen && (
          <div style={menuStyle}>
            <style>
              {`@keyframes ch-menu-in {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
              }`}
            </style>
            <button
              style={menuItemStyle}
              onClick={() => {
                setMenuOpen(false);
                reset();
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {t("new_conversation")}
            </button>
          </div>
        )}
      </div>
      <button
        onClick={close}
        style={headerButtonStyle}
        aria-label={t("close_chat")}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
