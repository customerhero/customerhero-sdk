---
"@customerhero/js": patch
"@customerhero/react": patch
---

Send the transcript-read capability token on action-approval and
workflow-approval decision requests.

The API now **requires** this token on the `/tool-calls/:id/decision` and
`/workflow-approvals/:id/decision` endpoints (approving executes a configured
action, so — like reading the transcript — a leaked `pendingId`/`approvalId`
alone must not authorize it). The client now appends the stored read token as
`?t=` on those requests (a query param, not a header, to satisfy the endpoint's
CORS preflight). Without this, approve/cancel would be rejected with 403 against
the updated API.
