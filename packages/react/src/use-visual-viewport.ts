import { useEffect, useState } from "react";

export interface VisualViewportRect {
  /** Height of the area actually visible to the user, in CSS pixels. */
  height: number;
  /** Distance from the top of the layout viewport to the visible area. */
  offsetTop: number;
}

/**
 * Tracks `window.visualViewport` while `enabled`, so a fullscreen panel can
 * size itself to what the user can actually see.
 *
 * This is what keeps the composer above the software keyboard on iOS: Safari
 * does not shrink the layout viewport when the keyboard opens, so a
 * `position: fixed; inset: 0` panel keeps its full height and the bottom of
 * it — the input — ends up underneath the keyboard. The visual viewport
 * *does* shrink, so pinning the panel to `height: rect.height` at
 * `top: rect.offsetTop` follows the keyboard instead of hiding behind it.
 *
 * Returns null when disabled or when the API is missing (older browsers,
 * SSR, jsdom); callers fall back to plain `inset: 0`.
 */
export function useVisualViewport(enabled: boolean): VisualViewportRect | null {
  const [rect, setRect] = useState<VisualViewportRect | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setRect(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;
    const update = () => {
      // The keyboard animates open over several frames and fires a burst of
      // resize/scroll events; coalescing into one rAF keeps the panel from
      // re-laying out on each of them.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setRect({
          height: Math.round(vv.height),
          offsetTop: Math.round(vv.offsetTop),
        });
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return rect;
}
