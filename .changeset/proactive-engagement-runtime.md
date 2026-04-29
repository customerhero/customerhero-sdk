---
"@customerhero/js": minor
"@customerhero/react": minor
---

Add proactive engagement runtime: client-side rules engine that evaluates the trigger tree returned by `GET /api/widget/:chatbotId/config`, DOM watchers (time-on-page, scroll depth, exit intent, SPA navigation), and per-action handlers for `open_widget`, `send_message`, `show_form`, and `open_with_prefill`. Frequency dedup uses `localStorage` (`once_ever`) and `sessionStorage` (`once_per_session`), keyed by chatbot + trigger id.

New public surface on `CustomerHeroChat` / `useChat`:

- `setConsent({ analytics })` — until called, only direct launcher clicks fire; behavioral conditions stay dormant. Persisted in `localStorage` (`ch_consent`) so revisits don't re-prompt.
- `setTraits(traits)` — feeds `visitor_trait` conditions.
- `submitPreChatForm(submission)` / `cancelPreChatForm()` — drives the new pre-chat-form gating shown before the first message when configured by the chatbot owner.
- `fireTrigger(triggerId)` — programmatically dispatch a trigger's action.
- `consumePendingPrefill()` — read the prefill set by an `open_with_prefill` trigger.

`POST /api/chat/:chatbotId` now carries `triggeredByTriggerId` and `prechatSubmission` on the very first turn so the server can attribute the conversation and synthesize a customer record.

`@customerhero/react` renders the configured pre-chat form inline in `ChatWindow` whenever the form is enabled and not yet submitted, suspending sends until the form is completed.

New exports from `@customerhero/js`: `evaluate`, `pickFire`, `startTriggersRuntime`, plus types `TriggerDefinition`, `TriggerConditionNode`, `TriggerConditionLeaf`, `TriggerAction`, `TriggerFrequency`, `PreChatField`, `PreChatFieldKind`, `PreChatFormConfig`, `PreChatSubmission`, `ConsentSettings`, `VisitorContext`.
