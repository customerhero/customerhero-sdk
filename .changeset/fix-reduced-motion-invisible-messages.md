---
"@customerhero/react": patch
---

Fix streamed bot messages rendering invisibly (`opacity: 0`). On the first token, the parent's `newStartIndex` advances and the bubble's `animate` prop flips from `true` to `false`, which cancelled the scheduled `requestAnimationFrame` before it could flip the bubble visible. The bubble now becomes visible immediately when `animate` turns off (or when `prefers-reduced-motion` is on).
