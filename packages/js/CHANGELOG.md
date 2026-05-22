# @customerhero/js

## 2.4.0

### Minor Changes

- 92ab801: Surface attachments in chat history. `loadHistory()` now hydrates the `attachments[]` field on each `ChatMessage` (new exported `MessageAttachment` type), and the React `<ChatMessages>` component renders them under the bubble: images inline as thumbnails, documents/audio/video as a download tile, and shared locations as a pin tile linking to OpenStreetMap. Returning visitors no longer lose their previously-uploaded screenshots and PDFs.

### Patch Changes

- Resolve the action-confirmation decision endpoint from the block's
  `approveHref` / `cancelHref` instead of hardcoding the tool-call path, so
  the same confirmation UI backs both LLM tool-call decisions and workflow
  approval nodes. Falls back to the legacy `/tool-calls/:id/decision` path
  when the href fields are absent.
- 72b0c60: Send the transcript-read capability token (C3) when loading conversation
  history. The widget now stores the `readToken` issued with each chat
  reply (JSON `readToken` field and the SSE `read-token` event) next to
  the conversation id, and presents it as the `?t=` query parameter on
  `GET /api/chat/:chatbotId/messages/:conversationId`. A `403` (invalid or
  expired token) clears the stored conversation and starts fresh. No
  public API change — the token is handled internally. This lets the
  server stop returning a full transcript to anyone who merely knows the
  conversation id once the token becomes required server-side.

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
  - Keep "Capture screenshot" on a single line in the attach menu.
  - Right-align the "Sent" status indicator under user messages.
  - Smarter autoscroll while streaming: stop fighting the user when they scroll up, and anchor the top of a long reply (with a small gap) instead of pinning the bottom so the start of the message stays in view.
  - Render visible bullets / numbers for markdown `ul` / `ol` lists, including on host pages whose CSS resets strip list markers.

## 2.1.0

### Patch Changes

- - react: paperclip attachment menu with drag-and-drop and paste support
  - react: accept PDFs in the attachment menu
  - react: hold launcher rendering until widget config has loaded
  - js: mark user bubble as sent on `response.ok` instead of waiting for the metadata event

## 2.0.0

### Major Changes

- Re-release at 2.0.0 to fix a broken peer dependency in `@customerhero/react@1.1.0` (its `@customerhero/js` peer was locked to `^2.0.0` but the matching js package was published at 1.1.0). Both packages are now realigned at 2.0.0; no behavioral or API change beyond what landed in 1.1.0.

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

## 1.0.1

## 1.0.0

### Minor Changes

- Widget SDK phases 1–4: action confirmation card + decision SSE consumer (`approveAction` / `cancelAction`, `ActionConfirmationBlock`, `<ActionConfirmationCard>`); full localization (14 locales, runtime `setLocale`, RTL helpers, `stringOverrides`, `?lang=` URL override); per-message `status` field (`sending` / `sent` / `failed`) and status pill UI; screenshot capture + attachment upload (`captureScreenshot`, `canCaptureScreenshot`, `uploadAttachment`, `sendMessage(text, { attachmentTokens })`, composer camera button + thumbnail strip).

  All additions are backwards compatible.

## 0.0.2

### Patch Changes

- Fix default `apiBase` to `https://api.customerhero.app`. The previous default pointed at the marketing site, which does not serve the widget config endpoint.
