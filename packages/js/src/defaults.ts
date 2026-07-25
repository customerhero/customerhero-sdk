export const DEFAULTS = {
  apiBase: "https://api.customerhero.app",
  primaryColor: "#6C3CE1",
  backgroundColor: "#FFFFFF",
  textColor: "#1A1A2E",
  position: "bottom-right" as const,
  placeholderText: "Type your message...",
  welcomeMessage: "Hi! How can I help you today?",
  title: "CustomerHero",
  // Appearance pack (B1–B6) defaults.
  colorScheme: "light" as "auto" | "light" | "dark",
  // Dark fallbacks used when the effective scheme is dark and no per-chatbot
  // dark color is configured. Operators can — and should — override these.
  primaryColorDark: "#A78BFA",
  backgroundColorDark: "#0F172A",
  textColorDark: "#E5E7EB",
  size: "default" as "compact" | "default" | "large",
  cornerStyle: "rounded" as "soft" | "rounded" | "square",
  offsetBottom: 20,
  offsetSide: 20,
  zIndex: 99999,
  mobileFullscreen: true,
};

// Viewport size at (or below) which the panel takes over the whole screen
// instead of floating above the launcher. 480 px covers phones in portrait;
// the height half of the query catches phones held in landscape, where a
// 520 px-tall panel would otherwise be squeezed to a couple of visible
// message rows.
export const MOBILE_BREAKPOINT = 480;

/**
 * Media query that decides when the widget switches to its fullscreen
 * (mobile) layout. Exported so hosts and the React bindings agree on a
 * single definition of "mobile" rather than each picking a breakpoint.
 *
 * The height clause is gated on a coarse pointer so a short-but-wide desktop
 * window (dev tools docked to the bottom, say) keeps the floating panel.
 */
export const MOBILE_LAYOUT_QUERY =
  `(max-width: ${MOBILE_BREAKPOINT}px), ` +
  `(max-height: ${MOBILE_BREAKPOINT}px) and (pointer: coarse)`;

// Size preset → bubble diameter, panel dimensions, base font size.
export const SIZE_PRESETS = {
  compact: { bubble: 48, width: 320, height: 480, fontSize: 13 },
  default: { bubble: 56, width: 380, height: 520, fontSize: 14 },
  large: { bubble: 64, width: 440, height: 600, fontSize: 15 },
} as const;

// Corner-style preset → panel border radius. Bubble stays circular regardless.
export const CORNER_RADIUS = {
  soft: 8,
  rounded: 16,
  square: 0,
} as const;
