import type { Node } from "@vscode/tree-sitter-wasm";

/** A source snapshot whose text is interpreted using the specified language's rules. */
export interface SourceText {
  readonly languageId: string;
  readonly text: string;
}

/** A declaration lookup within a source snapshot. */
export interface DocumentationTarget {
  /** UTF-16 code unit offset into the source text. */
  readonly offset: number;
  /**
   * Names match [start, end). The second mode also accepts declaration or wrapper starts
   * that identify exactly one declaration.
   */
  readonly match: "name" | "name-or-declaration-start";
}

/** Internal language rules consumed by the shared AST traversal. */
export interface CommentLanguage {
  grammar: string;
  declarations: readonly string[];
  wrappers?: readonly string[];
  /** Restricts which declarations may receive documentation from an enclosing wrapper. */
  canUseWrapper?(node: Node): boolean;
  declarationNames?(node: Node): Node[];
  /** Undefined permits wrapper lookup; an empty string stops it without producing documentation. */
  documentation(node: Node, text: string): string | undefined;
}
