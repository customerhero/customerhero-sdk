---
"@customerhero/js": minor
"@customerhero/react": minor
---

Add the widget appearance pack (B1–B6): `colorScheme` (`auto` / `light` / `dark`) with explicit dark colors (`primaryColorDark`, `backgroundColorDark`, `textColorDark`); `size` (`compact` / `default` / `large`); `cornerStyle` (`soft` / `rounded` / `square`); `launcher` customization (`iconUrl`, `label`, `showOnlineDot`); per-edge `offset` (`bottom`, `side`); and a `zIndex` override.

Defaults: `colorScheme: "light"`, `size: "default"`, `cornerStyle: "rounded"`, `offset: { bottom: 20, side: 20 }`, `zIndex: 99999`. Dark colors are never auto-derived — operators set them explicitly when enabling dark or auto modes. `colorScheme: "auto"` subscribes to `prefers-color-scheme` so OS theme switches reflow the widget without a reload.

Each field is also accepted on the per-chatbot `widget_config` payload from `GET /api/widget/:chatbotId/config`. Host props always win over server-supplied values.
