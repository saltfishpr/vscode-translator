import { Node } from "@vscode/tree-sitter-wasm";
import { declarationNames } from "../declarations";
import { cleanComment, isComment, readCommentBlock } from "../documentation";
import type { CommentLanguage } from "../types";

/** Go declarations and documentation, including grouped specs, embedded fields and compiler directives. */
export const go: CommentLanguage = {
  grammar: "go",
  declarations: [
    "function_declaration",
    "method_declaration",
    "type_spec",
    "type_alias",
    "field_declaration",
    "method_elem",
    "var_spec",
    "const_spec",
    "short_var_declaration",
  ],
  wrappers: ["type_declaration", "var_declaration", "const_declaration", "var_spec_list", "statement_list"],
  declarationNames(node) {
    if (node.type === "short_var_declaration") {
      return (node.childForFieldName("left")?.namedChildren ?? []).filter(
        (child): child is Node => child?.type === "identifier",
      );
    }
    const names = declarationNames(node);
    if (node.type === "field_declaration" && names.length === 0) {
      const embeddedType = node.childForFieldName("type");
      if (embeddedType) {
        names.push(embeddedType);
      }
    }
    return names;
  },
  canUseWrapper(node) {
    // A statement list's documentation belongs only to its first statement.
    return node.parent?.type !== "statement_list" || !node.previousNamedSibling;
  },
  documentation(node, text) {
    return readCommentBlock(node, text, {
      preceding(comment, _declaration, source, gap) {
        if (!isComment(comment) || (gap.match(/\n/g)?.length ?? 0) > 1) {
          return "stop";
        }
        const lineStart = source.lastIndexOf("\n", comment.startIndex - 1) + 1;
        return source.slice(lineStart, comment.startIndex).trim() ? "stop" : "include";
      },
      trailing: true,
      clean(comment) {
        const body = comment.startsWith("//") ? comment.slice(2).replace(/^ ?/, "") : cleanComment(comment);
        return /^(?:go:|line |extern |export )/.test(body) ? undefined : body;
      },
    });
  },
};
