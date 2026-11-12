import { join } from "node:path";
import { Language, Parser, Tree } from "@vscode/tree-sitter-wasm";
import { findDeclaration } from "./declarations";
import { readDocumentation } from "./documentation";
import { commentLanguages } from "./languages";
import type { DocumentationTarget, SourceText } from "./types";

/** Extracts declaration documentation from source text without executing a language toolchain. */
export class CommentExtractor {
  private ready?: Promise<void>;
  private readonly parsers = new Map<string, Promise<Parser>>();
  private readonly trees: { grammar: string; text: string; tree: Tree }[] = [];
  private disposed = false;
  private active = 0;

  constructor(private readonly assetsPath: string) {}

  /** Reports whether the source language has declaration and documentation rules. */
  supportsLanguage(languageId: string): boolean {
    return Object.hasOwn(commentLanguages, languageId);
  }

  /**
   * Returns cleaned, nonempty documentation, or undefined for an unsupported language or no match.
   * Offsets count UTF-16 code units and must be integers in [0, source.text.length].
   * Rejects with RangeError for invalid offsets, and propagates parser initialization failures.
   * Calls after disposal reject; calls already in progress may finish.
   */
  async extract(source: SourceText, target: DocumentationTarget): Promise<string | undefined> {
    if (this.disposed) {
      throw new Error("CommentExtractor has been disposed.");
    }
    const { languageId, text } = source;
    const { offset, match } = target;
    if (!Number.isInteger(offset) || offset < 0 || offset > text.length) {
      throw new RangeError("Documentation offset must be an integer within the source text.");
    }
    if (!this.supportsLanguage(languageId)) {
      return;
    }
    const rules = commentLanguages[languageId];
    const { grammar } = rules;
    this.active++;
    try {
      let pendingParser = this.parsers.get(grammar);
      if (!pendingParser) {
        this.ready ??= Parser.init({ locateFile: (file) => join(this.assetsPath, file) });
        pendingParser = this.ready.then(async () => {
          const language = await Language.load(join(this.assetsPath, `tree-sitter-${grammar}.wasm`));
          const parser = new Parser();
          parser.setLanguage(language);
          return parser;
        });
        this.parsers.set(grammar, pendingParser);
      }
      const parser = await pendingParser;
      let cached = this.trees.find((entry) => entry.grammar === grammar && entry.text === text);
      if (!cached) {
        const tree = parser.parse(text);
        if (!tree) {
          return;
        }
        cached = { grammar, text, tree };
        this.trees.push(cached);
        if (this.trees.length > 8) {
          this.trees.shift()!.tree.delete();
        }
      }
      const declaration = findDeclaration(cached.tree.rootNode, rules, { offset, match });
      if (declaration) {
        return readDocumentation(declaration, rules, text)?.trim() || undefined;
      }
    } finally {
      this.active--;
      if (this.disposed && this.active === 0) {
        this.release();
      }
    }
  }

  /**
   * Prevents new extraction requests and releases resources after in-progress requests finish.
   * Repeated calls are harmless.
   */
  dispose(): void {
    this.disposed = true;
    if (this.active === 0) {
      this.release();
    }
  }

  private release(): void {
    for (const { tree } of this.trees) {
      tree.delete();
    }
    this.trees.length = 0;
    for (const parser of this.parsers.values()) {
      void parser.then(
        (value) => value.delete(),
        () => {},
      );
    }
    this.parsers.clear();
  }
}
