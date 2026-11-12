import { Node } from "@vscode/tree-sitter-wasm";
import { declarationNames } from "../declarations";
import { isComment, readCommentBlock } from "../documentation";
import type { CommentLanguage } from "../types";

/** Ruby declarations and documentation, including constants, attribute symbols and block comments. */
export const ruby: CommentLanguage = {
  grammar: "ruby",
  declarations: ["class", "module", "method", "singleton_method", "assignment", "call"],
  wrappers: ["body_statement"],
  declarationNames(node) {
    if (node.type === "assignment") {
      const left = node.childForFieldName("left");
      return left?.type === "constant" ? [left] : [];
    }
    if (node.type === "call") {
      const method = node.childForFieldName("method");
      return method && ["attr_reader", "attr_writer", "attr_accessor"].includes(method.text)
        ? (node.childForFieldName("arguments")?.namedChildren ?? []).filter(
            (child): child is Node => child?.type === "simple_symbol",
          )
        : [];
    }
    return declarationNames(node);
  },
  canUseWrapper(node) {
    // A body statement's documentation belongs only to its first statement.
    return node.parent?.type !== "body_statement" || !node.previousNamedSibling;
  },
  documentation(node, text) {
    return readCommentBlock(node, text, {
      preceding(comment, _declaration, source) {
        if (!isComment(comment)) {
          return "stop";
        }
        const lineStart = source.lastIndexOf("\n", comment.startIndex - 1) + 1;
        return source.slice(lineStart, comment.startIndex).trim() ? "stop" : "include";
      },
      clean(comment) {
        const body = comment.startsWith("=begin")
          ? comment.replace(/^=begin[^\n]*\n/, "").replace(/\n=end[^\n]*$/, "")
          : comment.replace(/^# ?/, "");
        return /^(?:!|(?:coding|encoding)\s*[:=])/.test(body) ? undefined : body;
      },
    });
  },
};
