import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { MessageSource } from "@customerhero/js";
import { renderMarkdown, parseBlocks } from "../src/markdown/render";

function html(source: string, opts?: Parameters<typeof renderMarkdown>[1]) {
  const { container, unmount } = render(renderMarkdown(source, opts) as any);
  const out = container.innerHTML;
  unmount();
  cleanup();
  return out;
}

// ─── Block parser ────────────────────────────────────────────────────────

describe("parseBlocks", () => {
  it("splits paragraphs on blank lines", () => {
    const blocks = parseBlocks("a\n\nb");
    expect(blocks).toEqual([
      { kind: "paragraph", lines: ["a"] },
      { kind: "paragraph", lines: ["b"] },
    ]);
  });

  it("normalises CRLF and CR line endings", () => {
    const blocks = parseBlocks("a\r\n\r\nb\rc");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "paragraph"]);
    expect(blocks[1].lines).toEqual(["b", "c"]);
  });

  it("recognises ATX headings from level 1 to 6", () => {
    for (let n = 1; n <= 6; n++) {
      const hashes = "#".repeat(n);
      const blocks = parseBlocks(`${hashes} Title`);
      expect(blocks[0]).toEqual({
        kind: "heading",
        level: n,
        lines: ["Title"],
      });
    }
  });

  it("strips trailing closing-hashes on headings", () => {
    expect(parseBlocks("## Title ##")[0].lines[0]).toBe("Title");
  });

  it("does not treat 7 hashes as a heading", () => {
    expect(parseBlocks("####### too many")[0].kind).toBe("paragraph");
  });

  it("collects consecutive unordered list items", () => {
    const b = parseBlocks("- a\n- b\n* c\n+ d");
    expect(b).toHaveLength(1);
    expect(b[0]).toEqual({ kind: "ul", lines: ["a", "b", "c", "d"] });
  });

  it("collects consecutive ordered list items regardless of number", () => {
    const b = parseBlocks("1. one\n2. two\n10. ten");
    expect(b).toHaveLength(1);
    expect(b[0]).toEqual({ kind: "ol", lines: ["one", "two", "ten"] });
  });

  it("captures fenced code blocks without the fence lines", () => {
    const b = parseBlocks("```js\nconst x = 1;\n```");
    expect(b).toEqual([{ kind: "code", lines: ["const x = 1;"], lang: "js" }]);
  });

  it("handles an unterminated code fence by consuming the rest", () => {
    const b = parseBlocks("```\nunclosed\ncontent");
    expect(b).toHaveLength(1);
    expect(b[0].kind).toBe("code");
    expect(b[0].lines).toEqual(["unclosed", "content"]);
  });

  it("preserves markdown-looking content inside a code block verbatim", () => {
    const b = parseBlocks("```\n# not a heading\n**not bold**\n```");
    expect(b[0].lines).toEqual(["# not a heading", "**not bold**"]);
  });

  it("collects blockquotes and strips the leader", () => {
    const b = parseBlocks("> one\n> two");
    expect(b).toEqual([{ kind: "blockquote", lines: ["one", "two"] }]);
  });

  it("ends a paragraph when a new block starts without a blank line", () => {
    const b = parseBlocks("paragraph\n# heading");
    expect(b.map((x) => x.kind)).toEqual(["paragraph", "heading"]);
  });

  it("returns no blocks for empty or whitespace-only input", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("   \n\n  ")).toEqual([]);
  });
});

// ─── Inline rendering ────────────────────────────────────────────────────

describe("renderMarkdown — inline", () => {
  it("renders plain text as a paragraph", () => {
    expect(html("hello world")).toContain("<p");
    expect(html("hello world")).toContain("hello world");
  });

  it("renders **bold** with a <strong>", () => {
    const out = html("this is **bold** ok");
    expect(out).toContain("<strong>bold</strong>");
  });

  it("renders __bold__ with a <strong>", () => {
    expect(html("so __bold__!")).toContain("<strong>bold</strong>");
  });

  it("renders *italic* with an <em>", () => {
    expect(html("very *italic* text")).toContain("<em>italic</em>");
  });

  it("renders _italic_ with an <em> when surrounded by word boundaries", () => {
    expect(html("very _italic_ text")).toContain("<em>italic</em>");
  });

  it("does not treat underscores inside snake_case as italic", () => {
    const out = html("call foo_bar_baz now");
    expect(out).not.toContain("<em>");
    expect(out).toContain("foo_bar_baz");
  });

  it("renders inline `code` as a <code>", () => {
    const out = html("use `npm install`");
    expect(out).toMatch(/<code[^>]*>npm install<\/code>/);
  });

  it("does not interpret markdown inside inline code", () => {
    const out = html("see `**not bold**` here");
    expect(out).toMatch(/<code[^>]*>\*\*not bold\*\*<\/code>/);
    expect(out).not.toContain("<strong>");
  });

  it("renders links with target=_blank and rel=noopener", () => {
    const out = html("[docs](https://customerhero.app)");
    expect(out).toContain('href="https://customerhero.app"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain(">docs</a>");
  });

  it("allows mailto and tel links", () => {
    expect(html("[mail](mailto:a@b.com)")).toContain("mailto:a@b.com");
    expect(html("[call](tel:+1234)")).toContain("tel:+1234");
  });

  it("refuses javascript: URLs (never produces an anchor)", () => {
    const dangerous = "click [here](javascript:alert(1))";
    const out = html(dangerous);
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href=");
    // The dangerous string ends up as literal paragraph text — that's fine,
    // what matters is it's not wired to an anchor.
    expect(out).toContain("here");
  });

  it("refuses data: URLs (never produces an anchor)", () => {
    const out = html("[x](data:text/html,<script>)");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href=");
  });

  it("handles nested formatting inside link label", () => {
    const out = html("[**bold link**](https://a.com)");
    expect(out).toContain("<strong>bold link</strong>");
    expect(out).toContain('href="https://a.com"');
  });

  it("supports backslash escapes for special chars", () => {
    const out = html("\\*not italic\\* and \\[not link\\]");
    expect(out).not.toContain("<em>");
    expect(out).toContain("*not italic*");
    expect(out).toContain("[not link]");
  });

  it("renders hard breaks for two trailing spaces", () => {
    const out = html("line one  \nline two");
    expect(out).toContain("<br");
  });

  it("collapses a soft newline inside a paragraph into a space", () => {
    const out = html("line one\nline two");
    expect(out).not.toContain("<br");
    expect(out).toMatch(/line one\s+line two/);
  });

  it("ignores unknown characters and renders them literally", () => {
    expect(html("amount: $5.00")).toContain("$5.00");
  });

  it("escapes HTML entities (React auto-escapes)", () => {
    const out = html("<script>alert(1)</script>");
    // React renders this as text, never as an element.
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain("&lt;script&gt;");
  });

  it("handles an unclosed emphasis marker as literal text", () => {
    const out = html("half **open");
    expect(out).not.toContain("<strong>");
    expect(out).toContain("**open");
  });
});

// ─── Citations ───────────────────────────────────────────────────────────

const sources: MessageSource[] = [
  {
    index: 1,
    title: "Docs",
    url: "https://example.com/a",
    dataSourceId: "ds_1",
  },
  {
    index: 2,
    title: "FAQ",
    url: "https://example.com/b",
    dataSourceId: "ds_2",
  },
  { index: 3, title: "Note", dataSourceId: "ds_3" }, // no url
];

describe("renderMarkdown — citations", () => {
  it("renders [1] as a linked superscript when the source exists", () => {
    const out = html("See the docs [1] for details.", { sources });
    expect(out).toContain("<sup");
    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain("[1]");
  });

  it("renders [1, 2] as two links", () => {
    const out = html("Refs [1, 2] apply.", { sources });
    expect(out.match(/href=/g)?.length).toBe(2);
    expect(out).toContain("[1]");
    expect(out).toContain("[2]");
  });

  it("accepts [1,2] without a space", () => {
    const out = html("Refs [1,2].", { sources });
    expect(out.match(/href=/g)?.length).toBe(2);
  });

  it("renders a citation without a URL as a plain span with a title attr", () => {
    const out = html("See [3] for context.", { sources });
    expect(out).toContain("[3]");
    expect(out).not.toContain('href="undefined"');
  });

  it("does not render citations when no sources are supplied", () => {
    const out = html("See [1] please.");
    expect(out).not.toContain("<sup");
    expect(out).toContain("[1]");
  });

  it("ignores an out-of-range citation (falls back to literal)", () => {
    const out = html("See [99].", { sources });
    expect(out).not.toContain("<sup");
    expect(out).toContain("[99]");
  });

  it("ignores non-integer citation bodies (falls back to literal)", () => {
    const out = html("See [ref].", { sources });
    expect(out).not.toContain("<sup");
    expect(out).toContain("[ref]");
  });

  it("prefers link syntax over citation when both could apply", () => {
    // `[1](https://…)` must render as a link, not a citation.
    const out = html("Go [1](https://x.com).", { sources });
    expect(out).toContain('href="https://x.com"');
    expect(out).not.toContain("<sup");
  });
});

// ─── Block rendering ─────────────────────────────────────────────────────

describe("renderMarkdown — blocks", () => {
  it("renders heading levels h1–h6", () => {
    for (let n = 1; n <= 6; n++) {
      const out = html(`${"#".repeat(n)} Title`);
      expect(out).toContain(`<h${n}`);
    }
  });

  it("renders an unordered list with <ul><li>", () => {
    const out = html("- one\n- two");
    expect(out).toMatch(/<ul[^>]*>[\s\S]*<li>one<\/li>[\s\S]*<li>two<\/li>/);
  });

  it("renders an ordered list with <ol><li>", () => {
    const out = html("1. one\n2. two");
    expect(out).toMatch(/<ol[^>]*>[\s\S]*<li>one<\/li>/);
  });

  it("renders a fenced code block as <pre><code>", () => {
    const out = html("```\nabc\ndef\n```");
    expect(out).toContain("<pre");
    expect(out).toContain("<code>abc\ndef</code>");
  });

  it("renders a blockquote as <blockquote>", () => {
    const out = html("> quoted");
    expect(out).toContain("<blockquote");
    expect(out).toContain("quoted");
  });

  it("renders inline markdown inside list items", () => {
    const out = html("- **bold** item\n- _italic_ item");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
  });

  it("handles a realistic mixed document", () => {
    const source = [
      "# Heading",
      "",
      "A paragraph with **bold**, *italic*, and a [link](https://x.com).",
      "",
      "## Steps",
      "",
      "1. First thing",
      "2. Second thing",
      "",
      "```",
      "code",
      "```",
      "",
      "> a quote",
    ].join("\n");
    const out = html(source, { sources });
    expect(out).toContain("<h1");
    expect(out).toContain("<h2");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain("<ol");
    expect(out).toContain("<pre");
    expect(out).toContain("<blockquote");
  });
});
