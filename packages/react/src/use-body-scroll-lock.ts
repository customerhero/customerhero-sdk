import { useEffect } from "react";

/**
 * Freezes scrolling on the host page while `locked` — used when the widget
 * covers the whole screen, so a swipe that runs past the end of the message
 * list doesn't drag the page underneath (and, on iOS, doesn't send the URL
 * bar sliding in and out mid-conversation).
 *
 * Deliberately the mildest lock that works: only `overflow` is touched, and
 * the previous inline value is restored on unlock. The heavier
 * `position: fixed` body trick would reset the host page's scroll position,
 * which is not ours to lose.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [locked]);
}
