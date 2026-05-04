import { useEffect, useState } from "react";

/**
 * Live boolean for `prefers-color-scheme: dark`. Returns false during SSR or
 * when matchMedia is unavailable. Subscribes for the lifetime of the
 * component so OS-level theme switches reflow the widget without reload.
 */
export function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPrefersDark(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari < 14 fallback.
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return prefersDark;
}
