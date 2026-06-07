---
"@customerhero/js": patch
"@customerhero/react": patch
---

Send per-message thumbs feedback to the dedicated `/feedback` endpoint with the
transcript-read capability token.

`rateMessage` ("was this answer helpful?" thumbs up/down) previously POSTed to
`/rate` — the 1..5 CSAT survey endpoint, which ignores the thumbs body and
rejected every request. It now targets the new `/chat/:chatbotId/feedback`
endpoint with `{ conversationId, messageId, rating }` and appends the stored
read token as `?t=` (a query param, to satisfy the endpoint's CORS preflight).
The API **requires** this token on `/feedback`, so an older embed pointed at the
old path simply no-ops as before — there is no regression.
