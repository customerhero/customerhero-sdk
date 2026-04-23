// Minimal SSE reader. Streams `event:`/`data:` records from a ReadableStream
// and yields them one by one. Only supports what the chat API emits — single
// `event` + single `data` line per record, blank-line delimited.

export interface SSEEvent {
  event: string;
  data: string;
}

export async function* readSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line.
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const evt = parseSSERecord(raw);
        if (evt) yield evt;
        sep = buffer.indexOf("\n\n");
      }
    }
    // Flush any trailing event without a terminating blank line.
    const remaining = buffer.trim();
    if (remaining.length > 0) {
      const evt = parseSSERecord(remaining);
      if (evt) yield evt;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSSERecord(raw: string): SSEEvent | null {
  let event = "";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      // Append with newline if data spans multiple lines.
      data =
        data.length > 0
          ? `${data}\n${line.slice(5).trim()}`
          : line.slice(5).trim();
    }
  }
  if (!event) return null;
  return { event, data };
}
