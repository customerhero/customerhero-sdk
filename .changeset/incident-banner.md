---
"@customerhero/js": minor
"@customerhero/react": minor
---

Render the operator-controlled incident banner from the widget config.

The widget now reads `incidentBanner` off `GET /api/widget/:chatbotId/config` and shows a severity-styled chip below the header (info / warning / outage) with the operator's title, optional body, ETA, and CTA link. Visitors can dismiss the banner; the dismissal is persisted per chatbot and reset automatically when the operator changes the banner content. Banners with a past `expiresAt` are hidden client-side as a safety net.

Public surface:

- `IncidentBanner` type re-exported from `@customerhero/js`.
- `ChatState.incidentBanner` and `ChatState.incidentBannerDismissed`.
- `CustomerHeroChat.dismissIncidentBanner()` (no-op when no banner is showing).
- New translation keys `incident_dismiss` and `incident_default_link_label` (translated for all 15 supported locales).
- React: `useChat()` exposes `dismissIncidentBanner`; the embedded banner renders inside the `<ChatWidget>` automatically.

Also fixes `getStorage()` to fall back to `globalThis.localStorage` when `window` is unavailable, so the SDK behaves correctly in SSR / edge / test environments that surface storage on `globalThis` only.
