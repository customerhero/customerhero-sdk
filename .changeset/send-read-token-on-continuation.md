---
"@customerhero/js": patch
"@customerhero/react": patch
---

Send the transcript-read capability token on continuation chat sends.

The API now **requires** this token whenever a chat `POST /api/chat/:chatbotId`
includes a `conversationId` (continuing an existing conversation) — knowing only
the random `conversationId` previously let a visitor append to / read back
another visitor's conversation. The client now attaches the stored read token
(`ch_conv_token_<chatbotId>`, minted by the server on the first turn) as the
`X-CH-Read-Token` header on every continuation send. The first turn carries no
`conversationId` and needs no token. Without this, the second and later messages
of a conversation would be rejected with 403 against the updated API.
