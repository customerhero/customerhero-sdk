# @customerhero/react

## 2.4.1

### Patch Changes

- 8ac1eb5: Send the transcript-read capability token on action-approval and
  workflow-approval decision requests.

  The API now **requires** this token on the `/tool-calls/:id/decision` and
  `/workflow-approvals/:id/decision` endpoints (approving executes a configured
  action, so — like reading the transcript — a leaked `pendingId`/`approvalId`
  alone must not authorize it). The client now appends the stored read token as
  `?t=` on those requests (a query param, not a header, to satisfy the endpoint's
  CORS preflight). Without this, approve/cancel would be rejected with 403 against
  the updated API.

- 7cadc63: Send per-message thumbs feedback to the dedicated `/feedback` endpoint with the
  transcript-read capability token.

  `rateMessage` ("was this answer helpful?" thumbs up/down) previously POSTed to
  `/rate` — the 1..5 CSAT survey endpoint, which ignores the thumbs body and
  rejected every request. It now targets the new `/chat/:chatbotId/feedback`
  endpoint with `{ conversationId, messageId, rating }` and appends the stored
  read token as `?t=` (a query param, to satisfy the endpoint's CORS preflight).
  The API **requires** this token on `/feedback`, so an older embed pointed at the
  old path simply no-ops as before — there is no regression.

- d02af39: Send the transcript-read capability token on continuation chat sends.

  The API now **requires** this token whenever a chat `POST /api/chat/:chatbotId`
  includes a `conversationId` (continuing an existing conversation) — knowing only
  the random `conversationId` previously let a visitor append to / read back
  another visitor's conversation. The client now attaches the stored read token
  (`ch_conv_token_<chatbotId>`, minted by the server on the first turn) as the
  `X-CH-Read-Token` header on every continuation send. The first turn carries no
  `conversationId` and needs no token. Without this, the second and later messages
  of a conversation would be rejected with 403 against the updated API.

## 2.4.0

### Minor Changes

- 92ab801: Surface attachments in chat history. `loadHistory()` now hydrates the `attachments[]` field on each `ChatMessage` (new exported `MessageAttachment` type), and the React `<ChatMessages>` component renders them under the bubble: images inline as thumbnails, documents/audio/video as a download tile, and shared locations as a pin tile linking to OpenStreetMap. Returning visitors no longer lose their previously-uploaded screenshots and PDFs.

## 2.3.0

### Minor Changes

- 275e928: Add an `embedded` prop on `<ChatWidget>` that switches the launcher and chat panel from `position: fixed` to `position: absolute`, so the widget can be hosted inline (in a marketing demo, a documentation site, or a preview pane) without floating over the whole page. The host wraps `<ChatWidget>` in a `position: relative` container; offsets become relative to that container.

  Also: drop the server fallbacks for `colorScheme`, `offset`, and `zIndex` in `resolveConfig` — these are runtime knobs that depend on the host page, not the chatbot, so they're host-only now. The chatbot config keeps light + dark palettes, size, corner style, and launcher customization; runtime callers pass `colorScheme` etc. as `<ChatWidget>` props.

  Internal: `@customerhero/react/preview` is a new (undocumented) subpath that exports a `<PreviewWidget>` component used by the dashboard preview pane. It renders the real widget chrome against a host-supplied config without making any network calls.

- 54c6117: Theme the chat-header overflow menu and the chat-input attach menu against the active palette instead of forcing white, so they read correctly on dark-mode widgets. Surfaces (background, text, divider, hover) come from `useEffectiveTheme`.

  Add a `banner` prop on `<PreviewWidget>` (`@customerhero/react/preview`) that renders the chatbot's incident banner inside the preview chat window, with the same sanitization the real widget applies to fetched config. The dashboard's banner editor uses this for live in-form preview.

  Internal: `__seedForPreview(config, extras)` now accepts `{ banner: IncidentBanner | null }` and reseeds `state.incidentBanner` (plus resets `incidentBannerDismissed`) when re-keyed by the host. Public state field names are unchanged.

- a34be0e: Add the widget appearance pack (B1–B6): `colorScheme` (`auto` / `light` / `dark`) with explicit dark colors (`primaryColorDark`, `backgroundColorDark`, `textColorDark`); `size` (`compact` / `default` / `large`); `cornerStyle` (`soft` / `rounded` / `square`); `launcher` customization (`iconUrl`, `label`, `showOnlineDot`); per-edge `offset` (`bottom`, `side`); and a `zIndex` override.

  Defaults: `colorScheme: "light"`, `size: "default"`, `cornerStyle: "rounded"`, `offset: { bottom: 20, side: 20 }`, `zIndex: 99999`. Dark colors are never auto-derived — operators set them explicitly when enabling dark or auto modes. `colorScheme: "auto"` subscribes to `prefers-color-scheme` so OS theme switches reflow the widget without a reload.

  Each field is also accepted on the per-chatbot `widget_config` payload from `GET /api/widget/:chatbotId/config`. Host props always win over server-supplied values.

## 2.2.0

### Minor Changes

- 94b916b: Render the operator-controlled incident banner from the widget config.

  The widget now reads `incidentBanner` off `GET /api/widget/:chatbotId/config` and shows a severity-styled chip below the header (info / warning / outage) with the operator's title, optional body, ETA, and CTA link. Visitors can dismiss the banner; the dismissal is persisted per chatbot and reset automatically when the operator changes the banner content. Banners with a past `expiresAt` are hidden client-side as a safety net.

  Public surface:
  - `IncidentBanner` type re-exported from `@customerhero/js`.
  - `ChatState.incidentBanner` and `ChatState.incidentBannerDismissed`.
  - `CustomerHeroChat.dismissIncidentBanner()` (no-op when no banner is showing).
  - New translation keys `incident_dismiss` and `incident_default_link_label` (translated for all 15 supported locales).
  - React: `useChat()` exposes `dismissIncidentBanner`; the embedded banner renders inside the `<ChatWidget>` automatically.

  Also fixes `getStorage()` to fall back to `globalThis.localStorage` when `window` is unavailable, so the SDK behaves correctly in SSR / edge / test environments that surface storage on `globalThis` only.

## 2.1.1

### Patch Changes

- fix(react): widget UX polish
  - Auto-focus the text input when the widget opens so users can start typing immediately.
  - Replace the single-line text input with an auto-growing textarea (wraps long messages, grows up to ~6 lines, then scrolls internally). Enter sends, Shift+Enter inserts a newline.
  - Keep "Capture screenshot" on a single line in the attach menu.
  - Right-align the "Sent" status indicator under user messages.
  - Smarter autoscroll while streaming: stop fighting the user when they scroll up, and anchor the top of a long reply (with a small gap) instead of pinning the bottom so the start of the message stays in view.
  - Render visible bullets / numbers for markdown `ul` / `ol` lists, including on host pages whose CSS resets strip list markers.

## 2.1.0

### Minor Changes

- - react: paperclip attachment menu with drag-and-drop and paste support
  - react: accept PDFs in the attachment menu
  - react: hold launcher rendering until widget config has loaded
  - js: mark user bubble as sent on `response.ok` instead of waiting for the metadata event

## 2.0.0

### Major Changes

- Re-release at 2.0.0 to fix a broken peer dependency in `@customerhero/react@1.1.0` (its `@customerhero/js` peer was locked to `^2.0.0` but the matching js package was published at 1.1.0). Both packages are now realigned at 2.0.0; no behavioral or API change beyond what landed in 1.1.0.

### Patch Changes

- Updated dependencies
  - @customerhero/js@2.0.0

## 1.1.0

### Minor Changes

- 8c42c1b: Add proactive engagement runtime: client-side rules engine that evaluates the trigger tree returned by `GET /api/widget/:chatbotId/config`, DOM watchers (time-on-page, scroll depth, exit intent, SPA navigation), and per-action handlers for `open_widget`, `send_message`, `show_form`, and `open_with_prefill`. Frequency dedup uses `localStorage` (`once_ever`) and `sessionStorage` (`once_per_session`), keyed by chatbot + trigger id.

  New public surface on `CustomerHeroChat` / `useChat`:
  - `setConsent({ analytics })` — until called, only direct launcher clicks fire; behavioral conditions stay dormant. Persisted in `localStorage` (`ch_consent`) so revisits don't re-prompt.
  - `setTraits(traits)` — feeds `visitor_trait` conditions.
  - `submitPreChatForm(submission)` / `cancelPreChatForm()` — drives the new pre-chat-form gating shown before the first message when configured by the chatbot owner.
  - `fireTrigger(triggerId)` — programmatically dispatch a trigger's action.
  - `consumePendingPrefill()` — read the prefill set by an `open_with_prefill` trigger.

  `POST /api/chat/:chatbotId` now carries `triggeredByTriggerId` and `prechatSubmission` on the very first turn so the server can attribute the conversation and synthesize a customer record.

  `@customerhero/react` renders the configured pre-chat form inline in `ChatWindow` whenever the form is enabled and not yet submitted, suspending sends until the form is completed.

  New exports from `@customerhero/js`: `evaluate`, `pickFire`, `startTriggersRuntime`, plus types `TriggerDefinition`, `TriggerConditionNode`, `TriggerConditionLeaf`, `TriggerAction`, `TriggerFrequency`, `PreChatField`, `PreChatFieldKind`, `PreChatFormConfig`, `PreChatSubmission`, `ConsentSettings`, `VisitorContext`.

### Patch Changes

- Updated dependencies [8c42c1b]
  - @customerhero/js@1.1.0

## 1.0.1

### Patch Changes

- e2c37d8: Fix streamed bot messages rendering invisibly (`opacity: 0`). On the first token, the parent's `newStartIndex` advances and the bubble's `animate` prop flips from `true` to `false`, which cancelled the scheduled `requestAnimationFrame` before it could flip the bubble visible. The bubble now becomes visible immediately when `animate` turns off (or when `prefers-reduced-motion` is on).
  - @customerhero/js@1.0.1

## 1.0.0

### Minor Changes

- Widget SDK phases 1–4: action confirmation card + decision SSE consumer (`approveAction` / `cancelAction`, `ActionConfirmationBlock`, `<ActionConfirmationCard>`); full localization (14 locales, runtime `setLocale`, RTL helpers, `stringOverrides`, `?lang=` URL override); per-message `status` field (`sending` / `sent` / `failed`) and status pill UI; screenshot capture + attachment upload (`captureScreenshot`, `canCaptureScreenshot`, `uploadAttachment`, `sendMessage(text, { attachmentTokens })`, composer camera button + thumbnail strip).

  All additions are backwards compatible.

### Patch Changes

- Updated dependencies
  - @customerhero/js@1.0.0

## 0.0.2

### Patch Changes

- Fix default `apiBase` to `https://api.customerhero.app`. The previous default pointed at the marketing site, which does not serve the widget config endpoint.
- Updated dependencies
  - @customerhero/js@0.0.2
