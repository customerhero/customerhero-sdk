import {
  effectiveColors,
  panelRadius,
  resolveScheme,
  sizePreset,
  type EffectiveScheme,
} from "@customerhero/js";
import { useChat } from "./use-chat";
import { usePrefersDark } from "./use-prefers-dark";

export interface EffectiveTheme {
  scheme: EffectiveScheme;
  primary: string;
  background: string;
  text: string;
  /** Background tint for inbound (bot) message bubbles + small surfaces
   *  inside the panel. Slightly off the panel background so bubbles still
   *  read as a distinct shape. */
  bubbleBackground: string;
  /** Subtle border / divider color that works against the panel background
   *  in both schemes. */
  divider: string;
  size: ReturnType<typeof sizePreset>;
  radius: number;
}

/**
 * Single source of truth for the colors / size / corner radius the widget
 * should render with right now. Resolves `colorScheme` against the visitor's
 * OS preference and picks the dark or light palette accordingly. Every
 * widget component should call this rather than reading `config.primaryColor`
 * etc. directly.
 */
export function useEffectiveTheme(): EffectiveTheme {
  const { config } = useChat();
  const prefersDark = usePrefersDark();
  const scheme = resolveScheme(config.colorScheme, prefersDark);
  const colors = effectiveColors(config, scheme);
  const isDark = scheme === "dark";
  return {
    scheme,
    primary: colors.primary,
    background: colors.background,
    text: colors.text,
    bubbleBackground: isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0",
    divider: isDark ? "rgba(255,255,255,0.12)" : "#e0e0e0",
    size: sizePreset(config.size),
    radius: panelRadius(config.cornerStyle),
  };
}
