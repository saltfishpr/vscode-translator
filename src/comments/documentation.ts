import { Node } from "@vscode/tree-sitter-wasm";
import type { CommentLanguage } from "./types";

const commentNodes = new Set(["comment", "line_comment", "block_comment"]);

/** Rules for walking preceding siblings and cleaning the accepted comment text. */
export interface CommentBlockRules {
  /** last accepts the node and ends lookup; skip permits lookup across the node. */
  preceding(node: Node, declaration: Node, text: string, gap: string): "include" | "last" | "skip" | "stop";
  /** Returns undefined to remove a directive without leaving an empty line. */
  clean(comment: string): string | undefined;
  trailing?: boolean;
}

/** Reports whether a node is one of the comment nodes used by the supported grammars. */
export function isComment(node: Node): boolean {
  return commentNodes.has(node.type);
}

/** Removes C-style delimiters and decorative prefixes while retaining the comment body. */
export function cleanComment(comment: string): string {
  if (comment.startsWith("//")) {
    return comment.replace(/^\/\/[!/]*<? ?/, "");
  }
  return comment
    .replace(/^\/\*[*!]?<?/, "")
    .replace(/\*\/$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n");
}

/**
 * Reads adjacent comments according to language-owned rules. Returns undefined when no
 * comments were accepted, but preserves empty text so callers do not retry outer wrappers.
 */
export function readCommentBlock(declaration: Node, text: string, rules: CommentBlockRules): string | undefined {
  const comments: string[] = [];
  let start = declaration.startIndex;
  let previous = declaration.previousNamedSibling;
  while (previous) {
    const gap = text.slice(previous.endIndex, start);
    if (!/^\s*$/.test(gap)) {
      break;
    }
    const action = rules.preceding(previous, declaration, text, gap);
    if (action === "stop") {
      break;
    }
    if (action === "include" || action === "last") {
      comments.unshift(previous.text);
    }
    if (action === "last") {
      break;
    }
    start = previous.startIndex;
    previous = previous.previousNamedSibling;
  }
  if (comments.length === 0 && rules.trailing) {
    const trailing = declaration.nextNamedSibling;
    if (trailing && isComment(trailing) && trailing.startPosition.row === declaration.endPosition.row) {
      comments.push(trailing.text);
    }
  }
  if (comments.length > 0) {
    return comments
      .map((comment) => rules.clean(comment.replace(/\r?\n$/, "")))
      .filter((comment): comment is string => comment !== undefined)
      .join("\n")
      .trim();
  }
}

/** Reads documentation from a declaration or its configured wrappers, without inheriting enclosing type comments. */
export function readDocumentation(node: Node, rules: CommentLanguage, text: string): string | undefined {
  for (let declaration: Node | null = node; declaration;) {
    const documentation = rules.documentation(declaration, text);
    if (documentation !== undefined) {
      return documentation;
    }
    const parent: Node | null = declaration.parent;
    declaration =
      parent && rules.wrappers?.includes(parent.type) && (rules.canUseWrapper?.(declaration) ?? true) ? parent : null;
  }
}

/** Reads the closest JSDoc block, ignoring ordinary comments between it and the declaration. */
export function readJSDoc(node: Node, text: string): string | undefined {
  return readCommentBlock(node, text, {
    preceding(comment) {
      if (!isComment(comment)) {
        return "stop";
      }
      return comment.text.startsWith("/**") ? "last" : "skip";
    },
    clean: cleanComment,
  });
}
