---
"@customerhero/js": minor
"@customerhero/react": minor
---

Make the widget responsive on phones.

The chat panel now goes fullscreen at or below 480 px wide (and on short
landscape phones), hiding the launcher while it is open, freezing page scroll
behind it, and honouring safe-area insets. It sizes itself from
`window.visualViewport`, so the composer stays above the iOS software keyboard
instead of being buried under it.

Form controls render at 16 px on touch devices, which is what stops iOS Safari
zooming the page in when the composer takes focus; tap targets grow to 44 px
and the composer no longer auto-focuses on touch, so opening the widget doesn't
immediately throw up the keyboard.

Adds a `mobileFullscreen` config option (default `true`) to opt out, plus
`MOBILE_BREAKPOINT` / `MOBILE_LAYOUT_QUERY` exports from `@customerhero/js` for
hosts that want to match the breakpoint.
