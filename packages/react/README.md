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

See the full reference at [customerhero.app/docs](https://customerhero.app).

## License

MIT
