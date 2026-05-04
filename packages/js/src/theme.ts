import { CORNER_RADIUS, DEFAULTS, SIZE_PRESETS } from "./defaults";
import type { ResolvedConfig } from "./types";

export type EffectiveScheme = "light" | "dark";

/**
 * Resolve the configured `colorScheme` against the visitor's OS preference.
 * `prefersDark` is the live value of `matchMedia("(prefers-color-scheme: dark)")`
 * (or `false` when not running in a browser). Kept as a pure function so the
 * caller subscribes once and re-renders.
 */
export function resolveScheme(
  colorScheme: ResolvedConfig["colorScheme"],
  prefersDark: boolean,
): EffectiveScheme {
  if (colorScheme === "dark") return "dark";
  if (colorScheme === "light") return "light";
  return prefersDark ? "dark" : "light";
}

/**
 * Pick the colors that should drive the widget render right now. When the
 * effective scheme is dark and a dark color is configured, use it; otherwise
 * fall back to the light color (so half-configured dark mode still ships
 * something readable rather than a white panel with white text).
 */
export function effectiveColors(
  config: ResolvedConfig,
  scheme: EffectiveScheme,
): { primary: string; background: string; text: string } {
  if (scheme === "dark") {
    return {
      primary: config.primaryColorDark ?? DEFAULTS.primaryColorDark,
      background: config.backgroundColorDark ?? DEFAULTS.backgroundColorDark,
      text: config.textColorDark ?? DEFAULTS.textColorDark,
    };
  }
  return {
    primary: config.primaryColor,
    background: config.backgroundColor,
    text: config.textColor,
  };
}

export function sizePreset(size: ResolvedConfig["size"]) {
  return SIZE_PRESETS[size];
}

export function panelRadius(cornerStyle: ResolvedConfig["cornerStyle"]) {
  return CORNER_RADIUS[cornerStyle];
}
