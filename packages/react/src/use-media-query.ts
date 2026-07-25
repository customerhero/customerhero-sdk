import { useEffect, useState } from "react";

/**
 * Live boolean for an arbitrary media query. Returns false during SSR and in
 * environments without `matchMedia` (jsdom without the test polyfill), and
 * stays subscribed for the lifetime of the component so orientation changes,
 * window resizes, and OS theme switches reflow the widget without a reload.
 *
 * The first value is read synchronously so mount-time decisions — whether to
 * pull up the software keyboard, which font size avoids iOS's focus zoom —
 * are right on the first frame rather than one render late. Safe here because
 * every widget surface mounts client-side after its config fetch, so there is
 * no server markup for this to disagree with.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesQuery(query));

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari < 14 fallback.
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [query]);

  return matches;
}

function matchesQuery(query: string): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(query).matches;
}
