import MarkdownIt from "markdown-it";
import type * as vscode from "vscode";
import type { TranslatorConfig } from "./config";
import { translate } from "./translation";

export const translateHoverCommand = "translator._translateHover";

const markdownParser = new MarkdownIt("commonmark");

type HoverPart = {
  text: string;
  shouldTranslate: boolean;
};

function splitMarkdown(markdown: string): HoverPart[] {
  const lines = [
    0,
    ...Array.from(markdown.matchAll(/\r\n|\r|\n/g), (match) => match.index + match[0].length),
    markdown.length,
  ];
  const blocks: { start: number; end: number }[] = [];
  const prose: { start: number; end: number }[] = [];
  for (const token of markdownParser.parse(markdown, {})) {
    if (!token.map) {
      continue;
    }
    const range = { start: lines[token.map[0]], end: lines[token.map[1]] };
    if (token.type === "fence" || token.type === "code_block") {
      blocks.push(range);
    } else if (
      (token.type === "html_block" && token.content.trim()) ||
      (token.type === "inline" &&
        token.children?.some(
          (child) => ["text", "code_inline", "html_inline", "image"].includes(child.type) && child.content.trim(),
        ))
    ) {
      prose.push(range);
    }
  }

  blocks.sort((a, b) => a.start - b.start);
  const parts: HoverPart[] = [];
  const appendProse = (start: number, end: number): void => {
    parts.push({
      text: markdown.slice(start, end),
      shouldTranslate: prose.some((range) => range.start < end && range.end > start),
    });
  };
  let offset = 0;
  for (const block of blocks) {
    if (block.start > offset) {
      appendProse(offset, block.start);
    }
    if (block.end > offset) {
      parts.push({ text: markdown.slice(Math.max(offset, block.start), block.end), shouldTranslate: false });
      offset = block.end;
    }
  }
  appendProse(offset, markdown.length);
  return parts;
}

/** A snapshot of provider documentation, excluding this extension's hover action. */
export class HoverDocument {
  private readonly parts: HoverPart[] = [];
  readonly original: string;
  /** Whether any part of the snapshot needs translation. */
  readonly shouldTranslate: boolean;

  constructor(hovers: readonly vscode.Hover[]) {
    const contents: { markdown: string; code: boolean }[] = [];
    for (const hover of hovers) {
      for (const content of hover.contents) {
        if (typeof content !== "string" && "language" in content) {
          const fence = "`".repeat(
            Math.max(3, ...Array.from(content.value.matchAll(/`+/g), ([run]) => run.length + 1)),
          );
          contents.push({ markdown: `${fence}${content.language}\n${content.value}\n${fence}`, code: true });
        } else {
          const markdown = typeof content === "string" ? content : content.value;
          if (markdown.trim() && !markdown.startsWith(`[翻译](command:${translateHoverCommand}?`)) {
            contents.push({ markdown, code: false });
          }
        }
      }
    }
    for (const [index, { markdown, code }] of contents.entries()) {
      if (index > 0) {
        this.parts.push({ text: "\n\n", shouldTranslate: false });
      }
      if (code) {
        this.parts.push({ text: markdown, shouldTranslate: false });
      } else {
        // Parse each provider item independently so an unclosed fence cannot hide the next item's prose.
        this.parts.push(...splitMarkdown(markdown));
      }
    }
    this.original = this.parts.map(({ text }) => text).join("");
    this.shouldTranslate = this.parts.some(({ shouldTranslate }) => shouldTranslate);
  }

  /** Translates prose without sending code blocks to the service; returns undefined without prose. */
  async translate(config: TranslatorConfig): Promise<Awaited<ReturnType<typeof translate>> | undefined> {
    const started = performance.now();
    const translated: string[] = [];
    let provider = "";

    for (const { text, shouldTranslate } of this.parts) {
      if (!shouldTranslate) {
        translated.push(text);
        continue;
      }
      const leading = text.match(/^\s*/)![0];
      const trailing = text.match(/\s*$/)![0];
      const translation = await translate(text.trim(), config);
      provider = translation.provider;
      translated.push(leading + translation.text + trailing);
    }

    if (provider) {
      return { text: translated.join(""), provider, durationMs: performance.now() - started };
    }
  }
}
