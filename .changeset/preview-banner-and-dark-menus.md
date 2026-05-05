---
"@customerhero/js": minor
"@customerhero/react": minor
---

Theme the chat-header overflow menu and the chat-input attach menu against the active palette instead of forcing white, so they read correctly on dark-mode widgets. Surfaces (background, text, divider, hover) come from `useEffectiveTheme`.

Add a `banner` prop on `<PreviewWidget>` (`@customerhero/react/preview`) that renders the chatbot's incident banner inside the preview chat window, with the same sanitization the real widget applies to fetched config. The dashboard's banner editor uses this for live in-form preview.

Internal: `__seedForPreview(config, extras)` now accepts `{ banner: IncidentBanner | null }` and reseeds `state.incidentBanner` (plus resets `incidentBannerDismissed`) when re-keyed by the host. Public state field names are unchanged.
