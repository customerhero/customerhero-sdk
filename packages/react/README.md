# @customerhero/react

Drop-in React component for embedding the [CustomerHero](https://customerhero.app) chat widget.

## Install

```bash
npm install @customerhero/react @customerhero/js
```

`react` (>=18) and `@customerhero/js` are peer dependencies.

## Usage

```tsx
import { ChatWidget } from "@customerhero/react";

export function App() {
  return (
    <>
      {/* your app */}
      <ChatWidget chatbotId="bot_xxxxxxxxxxxxxxxxxxxx" />
    </>
  );
}
```

### Identify a signed-in user

Pass an `identity` prop to link conversations to a user record in your system. Use a stable `userId` and — in production — a server-signed `userHash` (HMAC-SHA256) to prevent impersonation.

```tsx
<ChatWidget
  chatbotId="bot_xxxxxxxxxxxxxxxxxxxx"
  identity={{
    userId: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    userHash: currentUser.chatUserHash,
  }}
/>
```

## Props

`ChatWidgetProps` extends [`CustomerHeroChatConfig`](https://www.npmjs.com/package/@customerhero/js) from `@customerhero/js`. Common props:

| Prop                | Type                              | Description                                                 |
| ------------------- | --------------------------------- | ----------------------------------------------------------- |
| `chatbotId`         | `string` (required)               | The chatbot to connect to.                                  |
| `identity`          | `IdentifyPayload`                 | Current user identity. Triggers `identify` when it changes. |
| `apiBase`           | `string`                          | API base URL override.                                      |
| `primaryColor`      | `string`                          | Accent color.                                               |
| `backgroundColor`   | `string`                          | Chat window background.                                     |
| `textColor`         | `string`                          | Text color.                                                 |
| `position`          | `"bottom-right" \| "bottom-left"` | Widget position.                                            |
| `placeholderText`   | `string`                          | Input placeholder.                                          |
| `welcomeMessage`    | `string`                          | Welcome message.                                            |
| `title`             | `string`                          | Header title.                                               |
| `avatarUrl`         | `string`                          | Bot avatar URL.                                             |
| `locale`            | `string`                          | Widget locale (`"en"`, `"es"`). Auto-detected if omitted.   |
| `suggestedMessages` | `string[]`                        | Quick-reply options shown before the first message.         |

### Appearance

| Prop                     | Type                                | Description                                                                  |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| `colorScheme`            | `"auto" \| "light" \| "dark"`       | `auto` follows the visitor's OS preference. Defaults to `light`.             |
| `primaryColorDark`       | `string`                            | Primary color in dark mode. Only honoured when the effective scheme is dark. |
| `backgroundColorDark`    | `string`                            | Background color in dark mode.                                               |
| `textColorDark`          | `string`                            | Text color in dark mode.                                                     |
| `size`                   | `"compact" \| "default" \| "large"` | Launcher diameter, panel dimensions, and base font size.                     |
| `cornerStyle`            | `"soft" \| "rounded" \| "square"`   | Panel border-radius preset.                                                  |
| `launcher.iconUrl`       | `string`                            | Custom launcher icon URL.                                                    |
| `launcher.label`         | `string`                            | CTA label next to the launcher (turns the bubble into a pill). Max 60 chars. |
| `launcher.showOnlineDot` | `boolean`                           | Show a small green dot on the launcher when agents are available.            |
| `offset.bottom`          | `number`                            | Pixel offset from the bottom edge. 0–1000. Defaults to 20.                   |
| `offset.side`            | `number`                            | Pixel offset from the side. 0–1000. Defaults to 20.                          |
| `zIndex`                 | `number`                            | Z-index override. Defaults to 99999.                                         |
| `mobileFullscreen`       | `boolean`                           | Fill the screen on phone-sized viewports. Defaults to true.                  |

Dark colors are never auto-derived. Set them explicitly when enabling dark or auto modes.

### Mobile behaviour

At or below 480 px wide — and on short landscape phones — the panel covers the
whole screen instead of floating above the launcher, the launcher fades out
while it is open, and the page behind stops scrolling until it closes. The
composer follows `window.visualViewport` so it rides above the iOS software
keyboard, form controls render at 16 px so Safari doesn't zoom the page in on
focus, and tap targets grow to 44 px on touch. Pass `mobileFullscreen={false}`
to keep the floating panel at every size.

See the full reference at [customerhero.app/docs](https://customerhero.app).

## License

MIT
