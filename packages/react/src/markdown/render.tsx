import type { ReactNode } from "react";
import type { MessageSource } from "@customerhero/js";

// Supported markdown surface (matches what our system prompt tells the LLM
// to emit). Deliberately narrower than CommonMark to keep the parser simple
// and XSS-free — we never produce raw HTML, only React elements.
//
// Block-level:
//   - Paragraph                  plain text separated by blank lines
//   - ATX heading                # .. ###### up to level 6
//   - Unordered list             lines starting with `- `, `* `, or `+ `
//   - Ordered list               lines starting with `1. `, `2. ` …
//   - Fenced code block          ``` … ```
//   - Blockquote                 lines starting with `> `
//
// Inline:
//   - Bold                       **x** or __x__
//   - Italic                     *x*  or _x_
//   - Inline code                `x`
//   - Link                       [label](https://…)
//   - Citation                   [1] or [1, 2, 3] — when sources are supplied
//   - Hard break                 trailing two spaces + newline
//   - Backslash escape           \* \_ \` \[ \] \( \) \\
//
// Anything we don't recognise is rendered as literal text.

export interface RenderOptions {
  sources?: MessageSource[];
  linkColor?: string;
}

// ─── Tokenisation ────────────────────────────────────────────────────────

interface Block {
  kind: "paragraph" | "heading" | "ul" | "ol" | "code" | "blockquote";
  // Heading level (1–6). Undefined for non-heading blocks.
  level?: number;
  // Raw lines of the block (fence markers stripped for code blocks).
  lines: string[];
  // Code-fence info string (language hint). Undefined if not a code block.
  lang?: string;
}

export function parseBlocks(source: string): Block[] {
  // Normalise line endings.
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block.
    const fenceMatch = line.match(/^```(.*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1].trim() || undefined;
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      // Skip the closing fence if present.
      if (i < lines.length) i++;
      blocks.push({ kind: "code", lines: body, lang });
      continue;
    }

    // ATX heading.
    const headingMatch = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length,
        lines: [headingMatch[2]],
      });
      i++;
      continue;
    }

    // Unordered list.
    if (/^(\s*)[-*+]\s+/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i])) {
        body.push(lines[i].replace(/^(\s*)[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", lines: body });
      continue;
    }

    // Ordered list.
    if (/^(\s*)\d+\.\s+/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^(\s*)\d+\.\s+/.test(lines[i])) {
        body.push(lines[i].replace(/^(\s*)\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", lines: body });
      continue;
    }

    // Blockquote — collect consecutive `> ` lines.
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "blockquote", lines: body });
      continue;
    }

    // Paragraph — consume until blank line or a new block-starter.
    const body: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() === "") break;
      if (
        /^```/.test(next) ||
        /^#{1,6}\s/.test(next) ||
        /^(\s*)[-*+]\s+/.test(next) ||
        /^(\s*)\d+\.\s+/.test(next) ||
        /^>\s?/.test(next)
      ) {
        break;
      }
      body.push(next);
      i++;
    }
    blocks.push({ kind: "paragraph", lines: body });
  }

  return blocks;
}

// ─── Inline parsing ──────────────────────────────────────────────────────

// Returns the index of the closing `end` marker starting from `from`, or -1.
// Honours backslash escapes. Never matches inside an already-opened code span.
function findClosing(text: string, from: number, end: string): number {
  let i = from;
  while (i <= text.length - end.length) {
    const c = text[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (text.startsWith(end, i)) return i;
    i++;
  }
  return -1;
}

interface InlineCtx {
  sources?: MessageSource[];
  linkColor: string;
  keyRoot: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nextKey: () => string;
}

function renderInlineText(text: string, ctx: InlineCtx): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = "";
  let i = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      out.push(buffer);
      buffer = "";
    }
  };

  while (i < text.length) {
    const c = text[i];

    // Backslash escape.
    if (c === "\\" && i + 1 < text.length) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    // Hard break: two spaces before a newline.
    if (c === " " && text[i + 1] === " " && text[i + 2] === "\n") {
      flushBuffer();
      out.push(<br key={ctx.nextKey()} />);
      i += 3;
      continue;
    }

    // Soft newline — render as a space inside a paragraph.
    if (c === "\n") {
      buffer += " ";
      i++;
      continue;
    }

    // Inline code. Uses a distinct path from bold/italic to avoid emitting
    // any styling inside the code span.
    if (c === "`") {
      const close = findClosing(text, i + 1, "`");
      if (close !== -1) {
        flushBuffer();
        out.push(
          <code
            key={ctx.nextKey()}
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: "0.92em",
              background: "rgba(0,0,0,0.06)",
              padding: "1px 4px",
              borderRadius: 3,
            }}
          >
            {text.slice(i + 1, close)}
          </code>,
        );
        i = close + 1;
        continue;
      }
    }

    // Bold.
    if (
      (text.startsWith("**", i) || text.startsWith("__", i)) &&
      i + 2 < text.length
    ) {
      const marker = text.slice(i, i + 2);
      const close = findClosing(text, i + 2, marker);
      if (close !== -1 && close > i + 2) {
        flushBuffer();
        const inner = renderInlineText(text.slice(i + 2, close), ctx);
        out.push(<strong key={ctx.nextKey()}>{inner}</strong>);
        i = close + 2;
        continue;
      }
    }

    // Italic. Must not be the start of a bold marker (handled above).
    // Also skip `_` inside words (e.g. snake_case) by requiring non-word on
    // the boundary for underscore-emphasis.
    if (c === "*" || c === "_") {
      const prev = i === 0 ? " " : text[i - 1];
      const isWordBoundaryBefore = c === "*" || !/\w/.test(prev);
      if (isWordBoundaryBefore) {
        const close = findClosing(text, i + 1, c);
        // Close marker must not be followed by another of the same char
        // (that would be a bold end).
        const prevOfClose =
          close === -1 ? " " : close + 1 < text.length ? text[close + 1] : " ";
        const isWordBoundaryAfter = c === "*" || !/\w/.test(prevOfClose);
        if (
          close !== -1 &&
          close > i + 1 &&
          text[close + 1] !== c &&
          isWordBoundaryAfter
        ) {
          flushBuffer();
          const inner = renderInlineText(text.slice(i + 1, close), ctx);
          out.push(<em key={ctx.nextKey()}>{inner}</em>);
          i = close + 1;
          continue;
        }
      }
    }

    // Link: [label](url) — parse conservatively so citations still work.
    if (c === "[") {
      const closeLabel = findClosing(text, i + 1, "]");
      if (closeLabel !== -1 && text[closeLabel + 1] === "(") {
        const closeUrl = findClosing(text, closeLabel + 2, ")");
        if (closeUrl !== -1) {
          const label = text.slice(i + 1, closeLabel);
          const url = text.slice(closeLabel + 2, closeUrl).trim();
          if (isSafeUrl(url)) {
            flushBuffer();
            out.push(
              <a
                key={ctx.nextKey()}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: ctx.linkColor, textDecoration: "underline" }}
              >
                {renderInlineText(label, ctx)}
              </a>,
            );
            i = closeUrl + 1;
            continue;
          }
        }
      }

      // Citation: [n] or [n, m, ...] where each entry is a positive integer
      // matching a provided source index (1-based). Rendered as superscript
      // link(s).
      if (closeLabel !== -1 && ctx.sources && ctx.sources.length > 0) {
        const body = text.slice(i + 1, closeLabel).trim();
        const parts = body.split(/\s*,\s*/).filter((s) => s.length > 0);
        const indices = parts.map((p) => Number(p));
        const allValid =
          parts.length > 0 &&
          indices.every(
            (n) =>
              Number.isInteger(n) && n >= 1 && n <= (ctx.sources?.length ?? 0),
          );
        if (allValid) {
          flushBuffer();
          out.push(
            <sup key={ctx.nextKey()} style={{ whiteSpace: "nowrap" }}>
              {indices.map((n, idx) => {
                const src = ctx.sources![n - 1];
                const content = (
                  <span
                    style={{
                      fontSize: "0.75em",
                      color: ctx.linkColor,
                      cursor: src.url ? "pointer" : "default",
                    }}
                    title={
                      src.heading ? `${src.title} — ${src.heading}` : src.title
                    }
                  >
                    [{n}]
                  </span>
                );
                const separator = idx > 0 ? " " : null;
                return (
                  <span key={`${ctx.keyRoot}-cit-${idx}`}>
                    {separator}
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: ctx.linkColor,
                          textDecoration: "none",
                        }}
                      >
                        {content}
                      </a>
                    ) : (
                      content
                    )}
                  </span>
                );
              })}
            </sup>,
          );
          i = closeLabel + 1;
          continue;
        }
      }
    }

    buffer += c;
    i++;
  }

  flushBuffer();
  return out;
}

// Only allow http(s), mailto, and tel. Prevents javascript: / data: exfiltration.
function isSafeUrl(url: string): boolean {
  if (/^https?:\/\//i.test(url)) return true;
  if (/^mailto:/i.test(url)) return true;
  if (/^tel:/i.test(url)) return true;
  // Allow relative links.
  if (/^\/[^/]/.test(url) || /^#/.test(url)) return true;
  return false;
}

// ─── Block rendering ─────────────────────────────────────────────────────

export function renderMarkdown(
  source: string,
  opts: RenderOptions = {},
): ReactNode {
  const blocks = parseBlocks(source);
  const linkColor = opts.linkColor ?? "#6C3CE1";

  let keyCounter = 0;
  const ctx: InlineCtx = {
    sources: opts.sources,
    linkColor,
    keyRoot: "md",
    nextKey: () => `md-${keyCounter++}`,
  };

  const renderInline = (line: string) => renderInlineText(line, ctx);

  return (
    <>
      {blocks.map((block, idx) => {
        const key = `b-${idx}`;
        switch (block.kind) {
          case "heading": {
            const level = block.level ?? 1;
            const style = {
              margin: "8px 0 4px",
              fontWeight: 600,
              fontSize: level <= 2 ? "1.15em" : level === 3 ? "1.05em" : "1em",
            } as const;
            const children = renderInline(block.lines[0] ?? "");
            if (level === 1)
              return (
                <h1 key={key} style={style}>
                  {children}
                </h1>
              );
            if (level === 2)
              return (
                <h2 key={key} style={style}>
                  {children}
                </h2>
              );
            if (level === 3)
              return (
                <h3 key={key} style={style}>
                  {children}
                </h3>
              );
            if (level === 4)
              return (
                <h4 key={key} style={style}>
                  {children}
                </h4>
              );
            if (level === 5)
              return (
                <h5 key={key} style={style}>
                  {children}
                </h5>
              );
            return (
              <h6 key={key} style={style}>
                {children}
              </h6>
            );
          }
          case "paragraph":
            return (
              <p key={key} style={{ margin: "0 0 8px", lineHeight: 1.5 }}>
                {renderInline(block.lines.join("\n"))}
              </p>
            );
          case "ul":
            return (
              <ul
                key={key}
                style={{
                  margin: "0 0 8px",
                  paddingLeft: 20,
                  lineHeight: 1.5,
                }}
              >
                {block.lines.map((l, i) => (
                  <li key={i}>{renderInline(l)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={key}
                style={{
                  margin: "0 0 8px",
                  paddingLeft: 22,
                  lineHeight: 1.5,
                }}
              >
                {block.lines.map((l, i) => (
                  <li key={i}>{renderInline(l)}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre
                key={key}
                style={{
                  margin: "0 0 8px",
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: 6,
                  overflowX: "auto",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: "0.88em",
                  lineHeight: 1.45,
                }}
              >
                <code>{block.lines.join("\n")}</code>
              </pre>
            );
          case "blockquote":
            return (
              <blockquote
                key={key}
                style={{
                  margin: "0 0 8px",
                  padding: "4px 0 4px 10px",
                  borderLeft: "3px solid rgba(0,0,0,0.15)",
                  color: "rgba(0,0,0,0.75)",
                  fontStyle: "italic",
                }}
              >
                {renderInline(block.lines.join("\n"))}
              </blockquote>
            );
        }
      })}
    </>
  );
}
