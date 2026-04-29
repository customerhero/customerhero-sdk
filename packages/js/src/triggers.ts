// Pure rules engine for proactive-engagement triggers.
//
// `evaluate(node, ctx)` walks the AND/OR condition tree and returns true when
// the visitor matches. `pickFire(triggers, ctx, firedSet)` selects the
// highest-priority trigger that matches and isn't already deduped by
// frequency. No DOM access, no `window` / `document` reads — all dynamic
// signals come in through `ctx`. The runtime layer is responsible for
// keeping `ctx` up to date and for deciding when to call `pickFire` again.

import type {
  TriggerConditionLeaf,
  TriggerConditionNode,
  TriggerDefinition,
} from "./types";

export interface VisitorContext {
  url: string;
  queryParams: Record<string, string>;
  referrer: string;
  language: string;
  device: "mobile" | "tablet" | "desktop";
  /** Time spent on the current page (in ms). Pauses while the tab is hidden. */
  timeOnPageMs: number;
  /** Scroll depth as a percentage of the document height (0..100). Tracked as
   *  a high-water mark so a quick scroll-up doesn't undo a `scroll_depth`
   *  match. */
  scrollPercent: number;
  /** True after the runtime detected a desktop-style exit-intent gesture or
   *  the mobile fallback (visibilitychange→hidden after a grace period). */
  exitIntentSeen: boolean;
  /** Number of distinct sessions this visitor has visited the page. */
  returnVisitCount: number;
  /** Custom traits set by the integrator via `setTraits` / `identify`. */
  traits: Record<string, string | number | boolean>;
}

export function evaluate(
  node: TriggerConditionNode,
  ctx: VisitorContext,
): boolean {
  if (isGroup(node, "all")) {
    if (node.all.length === 0) return false;
    return node.all.every((child) => evaluate(child, ctx));
  }
  if (isGroup(node, "any")) {
    if (node.any.length === 0) return false;
    return node.any.some((child) => evaluate(child, ctx));
  }
  return evaluateLeaf(node as TriggerConditionLeaf, ctx);
}

function isGroup(
  node: TriggerConditionNode,
  key: "all",
): node is { all: TriggerConditionNode[] };
function isGroup(
  node: TriggerConditionNode,
  key: "any",
): node is { any: TriggerConditionNode[] };
function isGroup(node: TriggerConditionNode, key: "all" | "any"): boolean {
  return (
    !!node &&
    typeof node === "object" &&
    Array.isArray((node as Record<string, unknown>)[key])
  );
}

function evaluateLeaf(
  leaf: TriggerConditionLeaf,
  ctx: VisitorContext,
): boolean {
  switch (leaf.kind) {
    case "url_path": {
      const path = parseUrlPath(ctx.url);
      switch (leaf.op) {
        case "equals":
          return path === leaf.value;
        case "contains":
          return path.includes(leaf.value);
        case "starts_with":
          return path.startsWith(leaf.value);
        case "regex":
          return safeRegex(leaf.value).test(path);
        default:
          return false;
      }
    }
    case "url_query": {
      const has = Object.prototype.hasOwnProperty.call(
        ctx.queryParams,
        leaf.key,
      );
      if (leaf.op === "exists") return has;
      if (!has) return false;
      const v = ctx.queryParams[leaf.key] ?? "";
      if (leaf.op === "equals") return v === (leaf.value ?? "");
      if (leaf.op === "contains") return v.includes(leaf.value ?? "");
      return false;
    }
    case "referrer": {
      const r = ctx.referrer;
      if (leaf.op === "equals") return r === leaf.value;
      if (leaf.op === "contains") return r.includes(leaf.value);
      if (leaf.op === "regex") return safeRegex(leaf.value).test(r);
      return false;
    }
    case "time_on_page":
      return ctx.timeOnPageMs >= leaf.seconds * 1000;
    case "scroll_depth":
      return ctx.scrollPercent >= leaf.percent;
    case "exit_intent":
      return ctx.exitIntentSeen;
    case "device":
      return ctx.device === leaf.value;
    case "browser_language": {
      const lang = (ctx.language || "").toLowerCase();
      return leaf.values.some((v) => {
        const target = v.toLowerCase();
        // Allow partial matches: "en" matches "en-US".
        return lang === target || lang.startsWith(`${target}-`);
      });
    }
    case "visitor_trait": {
      const has = Object.prototype.hasOwnProperty.call(ctx.traits, leaf.key);
      if (leaf.op === "exists") return has;
      if (!has) return false;
      const v = ctx.traits[leaf.key];
      if (leaf.op === "equals") return v === leaf.value;
      if (leaf.op === "gt")
        return (
          typeof v === "number" &&
          typeof leaf.value === "number" &&
          v > leaf.value
        );
      if (leaf.op === "lt")
        return (
          typeof v === "number" &&
          typeof leaf.value === "number" &&
          v < leaf.value
        );
      return false;
    }
    case "return_visit": {
      if (leaf.op === "gte") return ctx.returnVisitCount >= leaf.count;
      if (leaf.op === "eq") return ctx.returnVisitCount === leaf.count;
      return false;
    }
    default:
      // Unknown leaf kind — older client, newer server. Fail closed.
      return false;
  }
}

function parseUrlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // Already a path, or a malformed input — best effort.
    return url.split("?")[0] ?? url;
  }
}

function safeRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch {
    // Never matches — keeps a malformed admin-entered pattern from throwing.
    return /^\b$/;
  }
}

/** Walk `triggers` in priority order (low number = high priority) and return
 *  the first one that matches `ctx` and isn't already in `firedSet`. The
 *  caller decides what `firedSet` means — once_ever uses long-lived storage,
 *  once_per_session uses the in-memory or sessionStorage set, every_time
 *  always misses the set so it can re-fire. */
export function pickFire(
  triggers: TriggerDefinition[],
  ctx: VisitorContext,
  firedSet: ReadonlySet<string>,
): TriggerDefinition | null {
  const sorted = triggers.slice().sort((a, b) => a.priority - b.priority);
  for (const t of sorted) {
    if (t.frequency !== "every_time" && firedSet.has(t.id)) continue;
    if (evaluate(t.conditions, ctx)) return t;
  }
  return null;
}
