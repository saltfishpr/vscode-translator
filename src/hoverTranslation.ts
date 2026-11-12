import MarkdownIt from "markdown-it";
import type * as vscode from "vscode";
import type { TranslatorConfig } from "./config";
import { translate } from "./translation";

export const translateHoverCommand = "translator._translateHover";

const markdownParser = new MarkdownIt("commonmark");

/** A snapshot of provider documentation, excluding this extension's hover action. */
export class HoverDocument {
  private readonly contents: { markdown: string; code: boolean }[] = [];
  readonly original: string;

  constructor(hovers: readonly vscode.Hover[]) {
    for (const hover of hovers) {
      for (const content of hover.contents) {
        if (typeof content !== "string" && "language" in content) {
          const fence = "`".repeat(
            Math.max(3, ...Array.from(content.value.matchAll(/`+/g), ([run]) => run.length + 1)),
          );
          this.contents.push({ markdown: `${fence}${content.language}\n${content.value}\n${fence}`, code: true });
        } else {
          const markdown = typeof content === "string" ? content : content.value;
          if (markdown.trim() && !markdown.startsWith(`[翻译](command:${translateHoverCommand}?`)) {
            this.contents.push({ markdown, code: false });
          }
        }
      }
    }
    this.original = this.contents.map(({ markdown }) => markdown).join("\n\n");
  }

  /** Translates prose only; code blocks never reach the provider. Returns undefined without prose. */
  async translate(config: TranslatorConfig): Promise<Awaited<ReturnType<typeof translate>> | undefined> {
    const started = performance.now();
    const translated: string[] = [];
    let provider = "";

    for (const { markdown, code } of this.contents) {
      if (code) {
        translated.push(markdown);
        continue;
      }

      // Parse each provider item independently: an unclosed fence must not hide the next item's prose.
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
        // Line ranges include container prefixes and preserve the original line endings.
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
      const parts: { start: number; end: number; code: boolean }[] = [];
      let offset = 0;
      for (const block of blocks) {
        if (block.start > offset) {
          parts.push({ start: offset, end: block.start, code: false });
        }
        if (block.end > offset) {
          parts.push({ start: Math.max(offset, block.start), end: block.end, code: true });
          offset = block.end;
        }
      }
      parts.push({ start: offset, end: markdown.length, code: false });

      const result: string[] = [];
      for (const part of parts) {
        const text = markdown.slice(part.start, part.end);
        if (part.code || !prose.some(({ start, end }) => start < part.end && end > part.start)) {
          result.push(text);
          continue;
        }
        const leading = text.match(/^\s*/)![0];
        const trailing = text.match(/\s*$/)![0];
        const translation = await translate(text.trim(), config);
        provider = translation.provider;
        result.push(leading + translation.text + trailing);
      }
      translated.push(result.join(""));
    }

    if (provider) {
      return { text: translated.join("\n\n"), provider, durationMs: performance.now() - started };
    }
  }
}
