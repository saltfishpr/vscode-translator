import { Node } from "@vscode/tree-sitter-wasm";
import { declarationNames } from "../declarations";
import { cleanComment, isComment, readCommentBlock } from "../documentation";
import type { CommentLanguage } from "../types";

/** C and C++ declarations and Doxygen comments, using the C++ grammar for both languages. */
export const cpp: CommentLanguage = {
  grammar: "cpp",
  declarations: [
    "function_definition",
    "declaration",
    "field_declaration",
    "type_definition",
    "alias_declaration",
    "class_specifier",
    "struct_specifier",
    "union_specifier",
    "enum_specifier",
    "enumerator",
    "namespace_definition",
    "preproc_def",
    "preproc_function_def",
  ],
  wrappers: ["template_declaration", "export_statement"],
  declarationNames(node) {
    const declarators = node.childrenForFieldName("declarator").filter((child): child is Node => child !== null);
    if (!declarators.length) {
      return declarationNames(node);
    }
    return declarators.map((declarator) => {
      let name = declarator;
      for (;;) {
        const nested =
          name.childForFieldName("declarator") ??
          (name.type === "parenthesized_declarator" ? name.firstNamedChild : null) ??
          (name.type === "qualified_identifier" ? name.childForFieldName("name") : null);
        if (!nested) {
          return name;
        }
        name = nested;
      }
    });
  },
  documentation(node, text) {
    return readCommentBlock(node, text, {
      preceding(comment, declaration, source) {
        if (!isComment(comment)) {
          return "stop";
        }
        const lineStart = source.lastIndexOf("\n", comment.startIndex - 1) + 1;
        if (
          source.slice(lineStart, comment.startIndex).trim() &&
          comment.endPosition.row < declaration.startPosition.row
        ) {
          return "stop";
        }
        return /^(?:\/\/[!/]*<|\/\*[*!]?<)/.test(comment.text) ? "stop" : "include";
      },
      trailing: true,
      clean: cleanComment,
    });
  },
};
