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
| `apiBase`           | `string`                          | API base URL. Defaults to `https://customerhero.app`.                       |
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

## License

MIT
