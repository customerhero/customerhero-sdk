# @customerhero/js

Framework-agnostic JavaScript client for the [CustomerHero](https://customerhero.app) chat widget. Use this package directly in vanilla JS / TS apps, or via the React bindings in [`@customerhero/react`](https://www.npmjs.com/package/@customerhero/react).

## Install

```bash
npm install @customerhero/js
```

## Quick start

```ts
import { CustomerHeroChat } from "@customerhero/js";

const chat = new CustomerHeroChat({
  chatbotId: "bot_xxxxxxxxxxxxxxxxxxxx",
});

chat.subscribe((state) => {
  // React to state changes — messages, open/closed, loading, etc.
});

chat.open();
await chat.sendMessage("Hello!");
```

## Identify a signed-in user

Link conversations to a user in your system by calling `identify` as soon as you know who the user is.

```ts
chat.identify({
  userId: "usr_123",
  email: "jane@example.com",
  name: "Jane Doe",
  // Optional HMAC for identity verification (recommended in production)
  userHash: "<hmac-sha256(userId, secret)>",
});
```

## Configuration

| Option              | Type                              | Description                                                                 |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `chatbotId`         | `string` (required)               | The chatbot to connect to.                                                  |
| `apiBase`           | `string`                          | API base URL. Defaults to `https://api.customerhero.app`.                   |
| `primaryColor`      | `string`                          | Accent color override.                                                      |
| `backgroundColor`   | `string`                          | Chat window background override.                                            |
| `textColor`         | `string`                          | Text color override.                                                        |
| `position`          | `"bottom-right" \| "bottom-left"` | Widget position.                                                            |
| `placeholderText`   | `string`                          | Input placeholder override.                                                 |
| `welcomeMessage`    | `string`                          | Welcome message override.                                                   |
| `title`             | `string`                          | Header title override.                                                      |
| `avatarUrl`         | `string`                          | Bot avatar URL override.                                                    |
| `locale`            | `string`                          | Widget locale (e.g. `"en"`, `"es"`). Auto-detected from browser if omitted. |
| `suggestedMessages` | `string[]`                        | Quick-reply options shown before the first message.                         |

### Appearance

| Option                   | Type                                | Description                                                                       |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| `colorScheme`            | `"auto" \| "light" \| "dark"`       | `auto` follows the visitor's OS preference. Defaults to `light`.                  |
| `primaryColorDark`       | `string`                            | Primary color used in dark mode. Only honoured when the effective scheme is dark. |
| `backgroundColorDark`    | `string`                            | Background color used in dark mode.                                               |
| `textColorDark`          | `string`                            | Text color used in dark mode.                                                     |
| `size`                   | `"compact" \| "default" \| "large"` | Launcher diameter, panel dimensions, and base font size.                          |
| `cornerStyle`            | `"soft" \| "rounded" \| "square"`   | Panel border-radius preset.                                                       |
| `launcher.iconUrl`       | `string`                            | Custom launcher icon URL (replaces the default chat-bubble glyph).                |
| `launcher.label`         | `string`                            | CTA label next to the launcher (turns the bubble into a pill). Max 60 chars.      |
| `launcher.showOnlineDot` | `boolean`                           | Show a small green dot on the launcher when agents are available.                 |
| `offset.bottom`          | `number`                            | Pixel offset from the bottom edge. 0–1000. Defaults to 20.                        |
| `offset.side`            | `number`                            | Pixel offset from the side (mirrors `position`). 0–1000. Defaults to 20.          |
| `zIndex`                 | `number`                            | Z-index override. Defaults to 99999. Capped at 2 000 000 000.                     |
| `mobileFullscreen`       | `boolean`                           | Fill the screen on phone-sized viewports. Defaults to true.                       |

Dark colors are never auto-derived from `primaryColor`/`backgroundColor`/`textColor` — set them explicitly when enabling dark or auto modes.

### Mobile behaviour

At or below 480 px wide — and on short landscape phones — the panel drops its
corner offsets and covers the whole screen, the launcher fades out while it is
open, and page scrolling behind the widget is frozen until it closes. The
composer tracks `window.visualViewport`, so it stays above the software
keyboard on iOS instead of being buried under it. Set `mobileFullscreen: false`
to keep the floating panel at every size; the exact breakpoint is exported as
`MOBILE_BREAKPOINT` / `MOBILE_LAYOUT_QUERY` if you need to match it in your own
styles.

Form controls render at 16 px on touch devices. That is the threshold below
which iOS Safari zooms the page in on focus, and it can only be avoided by
sizing the control — the `maximum-scale=1` viewport trick is the host page's to
make, is ignored by current iOS, and would cost pinch-zoom site-wide.

## License

MIT
