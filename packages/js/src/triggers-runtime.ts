// Browser runtime that feeds `pickFire` with a live `VisitorContext` and
// invokes `onFire(trigger)` whenever a trigger matches. The runtime takes a
// snapshot of the page once at start (URL, referrer, language, device) and
// progressively updates the dynamic signals (time on page, scroll depth,
// exit intent, SPA navigations, traits). Frequency dedup lives here too:
// once_ever → localStorage; once_per_session → sessionStorage; every_time
// → never marked.
//
// The runtime evaluates on every meaningful change (timer tick, scroll,
// visibility change, history change, trait update), which is enough to
// catch all condition kinds without rebuilding a complete event bus.

import { pickFire, type VisitorContext } from "./triggers";
import type { TriggerDefinition, TriggerFrequency } from "./types";

export interface TriggersRuntimeHandle {
  /** Stop all watchers and remove listeners. */
  stop(): void;
  /** Force a re-evaluation (used after the integrator calls setTraits). */
  reevaluate(): void;
  /** Update visitor traits and re-evaluate. */
  setTraits(traits: Record<string, string | number | boolean>): void;
  /** Mark a trigger as fired (used after a direct launcher click acted on
   *  a trigger or when the runtime fired one itself). */
  markFired(triggerId: string, frequency: TriggerFrequency): void;
}

export interface StartTriggersRuntimeOptions {
  chatbotId: string;
  triggers: TriggerDefinition[];
  /** Returns true when the runtime is allowed to fire a trigger. The client
   *  uses this to gate on consent — only direct launcher clicks fire until
   *  the integrator has called `setConsent({ analytics: true })`. */
  isAllowedToFire(): boolean;
  /** Called when a trigger is selected to fire. */
  onFire(trigger: TriggerDefinition): void;
  /** Optional initial traits seed. */
  initialTraits?: Record<string, string | number | boolean>;
}

const STORAGE_NS = "ch_trigger";
const RETURN_VISIT_KEY = "ch_visits";
const SCROLL_THROTTLE_MS = 250;
const EXIT_INTENT_GRACE_MS = 5000;

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function detectDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  // Touch + small screen — treat as tablet rather than desktop.
  if (
    window.matchMedia?.("(pointer: coarse)").matches &&
    window.innerWidth < 1024
  ) {
    return window.innerWidth < 600 ? "mobile" : "tablet";
  }
  return "desktop";
}

function parseQueryParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => {
      out[k] = v;
    });
  } catch {
    // ignore — opaque URL
  }
  return out;
}

function readReturnVisitCount(): number {
  const ls = getLocalStorage();
  if (!ls) return 1;
  try {
    const raw = ls.getItem(RETURN_VISIT_KEY);
    return raw ? Math.max(1, parseInt(raw, 10) || 1) : 1;
  } catch {
    return 1;
  }
}

function bumpReturnVisitCount(): number {
  const ls = getLocalStorage();
  const ss = getSessionStorage();
  if (!ls || !ss) return readReturnVisitCount();
  try {
    // Only bump once per session — multiple page navigations within the
    // same tab session shouldn't inflate the counter.
    if (ss.getItem("ch_visit_seen") === "1") return readReturnVisitCount();
    const current = parseInt(ls.getItem(RETURN_VISIT_KEY) ?? "0", 10) || 0;
    const next = current + 1;
    ls.setItem(RETURN_VISIT_KEY, String(next));
    ss.setItem("ch_visit_seen", "1");
    return next;
  } catch {
    return readReturnVisitCount();
  }
}

function firedKey(chatbotId: string, triggerId: string): string {
  return `${STORAGE_NS}_${chatbotId}_${triggerId}_fired`;
}

function readFired(
  chatbotId: string,
  triggers: TriggerDefinition[],
): Set<string> {
  const ls = getLocalStorage();
  const ss = getSessionStorage();
  const out = new Set<string>();
  for (const t of triggers) {
    if (t.frequency === "every_time") continue;
    try {
      const key = firedKey(chatbotId, t.id);
      if (t.frequency === "once_ever" && ls?.getItem(key) === "1") {
        out.add(t.id);
      } else if (
        t.frequency === "once_per_session" &&
        ss?.getItem(key) === "1"
      ) {
        out.add(t.id);
      }
    } catch {
      // ignore
    }
  }
  return out;
}

function writeFired(
  chatbotId: string,
  triggerId: string,
  frequency: TriggerFrequency,
): void {
  if (frequency === "every_time") return;
  const key = firedKey(chatbotId, triggerId);
  try {
    if (frequency === "once_ever") {
      getLocalStorage()?.setItem(key, "1");
    } else if (frequency === "once_per_session") {
      getSessionStorage()?.setItem(key, "1");
    }
  } catch {
    // best-effort
  }
}

export function startTriggersRuntime(
  options: StartTriggersRuntimeOptions,
): TriggersRuntimeHandle {
  if (typeof window === "undefined") {
    // Non-browser environment — return a no-op handle so SSR builds don't
    // explode at import time.
    return {
      stop() {},
      reevaluate() {},
      setTraits() {},
      markFired() {},
    };
  }

  const { chatbotId, triggers, onFire, isAllowedToFire } = options;

  let stopped = false;
  let exitIntentSeen = false;
  let scrollPercent = 0;
  let pageStartedAt = Date.now();
  let timeOnPageMs = 0;
  let lastVisibleAt = Date.now();
  let traits: Record<string, string | number | boolean> = {
    ...(options.initialTraits ?? {}),
  };
  const firedThisSession = new Set<string>();
  for (const id of readFired(chatbotId, triggers)) firedThisSession.add(id);

  const returnVisitCount = bumpReturnVisitCount();

  function snapshot(): VisitorContext {
    const url = window.location.href;
    return {
      url,
      queryParams: parseQueryParams(url),
      referrer: document.referrer || "",
      language: (navigator.language || "en").toLowerCase(),
      device: detectDevice(),
      timeOnPageMs,
      scrollPercent,
      exitIntentSeen,
      returnVisitCount,
      traits,
    };
  }

  function evaluate(): void {
    if (stopped) return;
    if (!isAllowedToFire()) return;
    if (triggers.length === 0) return;
    const ctx = snapshot();
    const trigger = pickFire(triggers, ctx, firedThisSession);
    if (!trigger) return;
    // Mark as fired before invoking the callback so a synchronous re-entry
    // (e.g. onFire opens the widget which triggers a re-evaluation) doesn't
    // double-fire.
    firedThisSession.add(trigger.id);
    writeFired(chatbotId, trigger.id, trigger.frequency);
    try {
      onFire(trigger);
    } catch (err) {
      // Never let an integrator handler take down the runtime.
      // eslint-disable-next-line no-console
      console.error("CustomerHero: trigger onFire handler threw", err);
    }
  }

  // ── Time on page ─────────────────────────────────────────────────────
  // Pause while the tab is hidden so a user with the page in a background
  // tab doesn't blow through a `time_on_page` trigger.
  const timerId = window.setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    timeOnPageMs += now - lastVisibleAt;
    lastVisibleAt = now;
    evaluate();
  }, 1000);

  function handleVisibility(): void {
    const now = Date.now();
    if (document.hidden) {
      timeOnPageMs += now - lastVisibleAt;
      // Mobile fallback for exit intent: tab hidden after a grace period.
      if (now - pageStartedAt > EXIT_INTENT_GRACE_MS && !exitIntentSeen) {
        exitIntentSeen = true;
        evaluate();
      }
    } else {
      lastVisibleAt = now;
      evaluate();
    }
  }
  document.addEventListener("visibilitychange", handleVisibility);

  // ── Scroll depth (high-water mark) ───────────────────────────────────
  let scrollScheduled = false;
  function handleScroll(): void {
    if (scrollScheduled) return;
    scrollScheduled = true;
    window.setTimeout(() => {
      scrollScheduled = false;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        scrollPercent = Math.max(scrollPercent, 100);
      } else {
        const next = (window.scrollY / scrollable) * 100;
        if (next > scrollPercent) {
          scrollPercent = next;
          evaluate();
        }
      }
    }, SCROLL_THROTTLE_MS);
  }
  window.addEventListener("scroll", handleScroll, { passive: true });

  // ── Desktop exit intent ──────────────────────────────────────────────
  function handleMouseOut(e: MouseEvent): void {
    if (exitIntentSeen) return;
    if (e.relatedTarget !== null) return;
    if (e.clientY > 0) return;
    if (Date.now() - pageStartedAt < EXIT_INTENT_GRACE_MS) return;
    exitIntentSeen = true;
    evaluate();
  }
  document.addEventListener("mouseout", handleMouseOut);

  // ── SPA navigation ───────────────────────────────────────────────────
  // Monkey-patch pushState/replaceState so client-side router calls produce
  // a `popstate`-like signal we can observe. Restore the originals on stop()
  // — important for hot reloads in dev.
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  function onUrlChange(): void {
    pageStartedAt = Date.now();
    timeOnPageMs = 0;
    lastVisibleAt = Date.now();
    scrollPercent = 0;
    exitIntentSeen = false;
    evaluate();
  }
  history.pushState = function patched(this: History, ...args) {
    const ret = origPush.apply(this, args as Parameters<History["pushState"]>);
    try {
      onUrlChange();
    } catch {
      // never let our patch throw
    }
    return ret;
  };
  history.replaceState = function patched(this: History, ...args) {
    const ret = origReplace.apply(
      this,
      args as Parameters<History["replaceState"]>,
    );
    try {
      onUrlChange();
    } catch {
      // never let our patch throw
    }
    return ret;
  };
  window.addEventListener("popstate", onUrlChange);

  // First evaluation right after listeners attach — covers triggers that
  // match the very first paint (URL/path-based, return-visit, etc.).
  // Defer one frame so the host has a chance to set traits / consent.
  const initialEval = window.setTimeout(evaluate, 0);

  return {
    stop() {
      stopped = true;
      window.clearInterval(timerId);
      window.clearTimeout(initialEval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("popstate", onUrlChange);
      history.pushState = origPush;
      history.replaceState = origReplace;
    },
    reevaluate() {
      evaluate();
    },
    setTraits(next) {
      traits = { ...traits, ...next };
      evaluate();
    },
    markFired(triggerId, frequency) {
      firedThisSession.add(triggerId);
      writeFired(chatbotId, triggerId, frequency);
    },
  };
}
