# @customerhero/react

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
