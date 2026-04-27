# @customerhero/js

## 1.0.0

### Minor Changes

- Widget SDK phases 1–4: action confirmation card + decision SSE consumer (`approveAction` / `cancelAction`, `ActionConfirmationBlock`, `<ActionConfirmationCard>`); full localization (14 locales, runtime `setLocale`, RTL helpers, `stringOverrides`, `?lang=` URL override); per-message `status` field (`sending` / `sent` / `failed`) and status pill UI; screenshot capture + attachment upload (`captureScreenshot`, `canCaptureScreenshot`, `uploadAttachment`, `sendMessage(text, { attachmentTokens })`, composer camera button + thumbnail strip).

  All additions are backwards compatible.

## 0.0.2

### Patch Changes

- Fix default `apiBase` to `https://api.customerhero.app`. The previous default pointed at the marketing site, which does not serve the widget config endpoint.
