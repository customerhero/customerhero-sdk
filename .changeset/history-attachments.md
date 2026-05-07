---
"@customerhero/js": minor
"@customerhero/react": minor
---

Surface attachments in chat history. `loadHistory()` now hydrates the `attachments[]` field on each `ChatMessage` (new exported `MessageAttachment` type), and the React `<ChatMessages>` component renders them under the bubble: images inline as thumbnails, documents/audio/video as a download tile, and shared locations as a pin tile linking to OpenStreetMap. Returning visitors no longer lose their previously-uploaded screenshots and PDFs.
