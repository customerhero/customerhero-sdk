import { useEffect, useState, type CSSProperties } from "react";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";
import { useEffectiveTheme } from "../use-effective-theme";

export function ChatBubble({ embedded }: { embedded?: boolean } = {}) {
  const { toggle, config, t, isRtl } = useChat();
  const reduced = useReducedMotion();
  const theme = useEffectiveTheme();
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

  const colors = theme;
  const preset = theme.size;

  // The launcher stays a circle by default. When a CTA label is configured,
  // the bubble becomes a wider pill so the text has somewhere to go.
  const hasLabel = !!config.launcher.label;
  const width = hasLabel ? "auto" : preset.bubble;
  const height = preset.bubble;
  const borderRadius = hasLabel ? preset.bubble / 2 : "50%";

  const style: CSSProperties = {
    position: embedded ? "absolute" : "fixed",
    bottom: config.offset.bottom,
    [effectivePosition === "bottom-left" ? "left" : "right"]:
      config.offset.side,
    width,
    height,
    minWidth: preset.bubble,
    paddingInline: hasLabel ? Math.round(preset.bubble * 0.35) : 0,
    borderRadius,
    background: colors.primary,
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: hasLabel ? 8 : 0,
    cursor: "pointer",
    boxShadow:
      theme.scheme === "dark"
        ? "0 6px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)"
        : "0 4px 20px rgba(0,0,0,0.15)",
    zIndex: config.zIndex,
    border: "none",
    fontSize: preset.fontSize,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: 500,
    opacity: visible ? 1 : 0,
    transform: visible ? "scale(1)" : "scale(0.6)",
    transition: reduced ? "none" : "opacity 0.25s ease, transform 0.25s ease",
    pointerEvents: visible ? "auto" : "none",
  };

  const iconSize = Math.round(preset.bubble * 0.43);
  const dotSize = Math.max(10, Math.round(preset.bubble * 0.22));
  const dotOffset = Math.round(preset.bubble * 0.08);
  const dotStyle: CSSProperties = {
    position: "absolute",
    top: dotOffset,
    [effectivePosition === "bottom-left" ? "left" : "right"]: dotOffset,
    width: dotSize,
    height: dotSize,
    borderRadius: "50%",
    background: "#22c55e",
    border: "2px solid rgba(255,255,255,0.9)",
    pointerEvents: "none",
  };

  return (
    <button
      onClick={toggle}
      style={style}
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={t("open_chat")}
      onMouseEnter={(e) => {
        if (!reduced) e.currentTarget.style.transform = "scale(1.06)";
      }}
      onMouseLeave={(e) => {
        if (!reduced) e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {config.launcher.iconUrl ? (
        <img
          src={config.launcher.iconUrl}
          alt=""
          width={iconSize}
          height={iconSize}
          style={{ display: "block" }}
        />
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}
      {hasLabel && <span>{config.launcher.label}</span>}
      {config.launcher.showOnlineDot && <span style={dotStyle} aria-hidden />}
    </button>
  );
}
