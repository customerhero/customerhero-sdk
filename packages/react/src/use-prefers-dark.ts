import { useMediaQuery } from "./use-media-query";

/**
 * Live boolean for `prefers-color-scheme: dark`. Returns false during SSR or
 * when matchMedia is unavailable. Subscribes for the lifetime of the
 * component so OS-level theme switches reflow the widget without reload.
 */
export function usePrefersDark(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}
