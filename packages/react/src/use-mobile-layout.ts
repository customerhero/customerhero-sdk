import { MOBILE_LAYOUT_QUERY } from "@customerhero/js";
import { useChat } from "./use-chat";
import { useMediaQuery } from "./use-media-query";

/**
 * Minimum font size a focusable form control can have on iOS without Safari
 * zooming the page in when it receives focus. There is no way to opt out of
 * that zoom from inside an embedded widget — the `maximum-scale=1` viewport
 * trick belongs to the host page, is ignored by modern iOS, and disables
 * pinch-zoom for the whole site — so the fix is simply to never render a
 * control below 16 px on touch devices.
 */
export const NO_ZOOM_FONT_SIZE = 16;

/**
 * True when the chat panel should take over the whole screen rather than
 * float above the launcher: a phone-sized viewport, with `mobileFullscreen`
 * left on. Always false for `embedded` renders, whose size is dictated by the
 * host container instead of the viewport.
 */
export function useFullscreenLayout(embedded?: boolean): boolean {
  const { config } = useChat();
  const isMobileViewport = useMediaQuery(MOBILE_LAYOUT_QUERY);
  return !embedded && config.mobileFullscreen && isMobileViewport;
}

/**
 * True on touch-primary devices (phones, tablets). Drives the tap-target and
 * font-size adjustments that only make sense when there is no mouse — a
 * desktop window narrowed past the mobile breakpoint keeps its finer chrome.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
