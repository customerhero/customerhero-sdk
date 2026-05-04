---
"@customerhero/js": minor
"@customerhero/react": minor
---

Add an `embedded` prop on `<ChatWidget>` that switches the launcher and chat panel from `position: fixed` to `position: absolute`, so the widget can be hosted inline (in a marketing demo, a documentation site, or a preview pane) without floating over the whole page. The host wraps `<ChatWidget>` in a `position: relative` container; offsets become relative to that container.

Also: drop the server fallbacks for `colorScheme`, `offset`, and `zIndex` in `resolveConfig` — these are runtime knobs that depend on the host page, not the chatbot, so they're host-only now. The chatbot config keeps light + dark palettes, size, corner style, and launcher customization; runtime callers pass `colorScheme` etc. as `<ChatWidget>` props.

Internal: `@customerhero/react/preview` is a new (undocumented) subpath that exports a `<PreviewWidget>` component used by the dashboard preview pane. It renders the real widget chrome against a host-supplied config without making any network calls.
