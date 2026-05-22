---
"@customerhero/js": patch
---

Send the transcript-read capability token (C3) when loading conversation
history. The widget now stores the `readToken` issued with each chat
reply (JSON `readToken` field and the SSE `read-token` event) next to
the conversation id, and presents it as the `?t=` query parameter on
`GET /api/chat/:chatbotId/messages/:conversationId`. A `403` (invalid or
expired token) clears the stored conversation and starts fresh. No
public API change — the token is handled internally. This lets the
server stop returning a full transcript to anyone who merely knows the
conversation id once the token becomes required server-side.
