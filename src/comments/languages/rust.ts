import { cleanComment, isComment, readCommentBlock } from "../documentation";
import type { CommentLanguage } from "../types";

/** Rust declarations and outer documentation comments, including comments separated by attributes. */
export const rust: CommentLanguage = {
  grammar: "rust",
  declarations: [
    "function_item",
    "function_signature_item",
    "struct_item",
    "enum_item",
    "enum_variant",
    "trait_item",
    "type_item",
    "const_item",
    "static_item",
    "mod_item",
    "union_item",
    "field_declaration",
    "associated_type",
    "macro_definition",
  ],
  documentation(node, text) {
    return readCommentBlock(node, text, {
      preceding(comment) {
        if (comment.type === "attribute_item") {
          return "skip";
        }
        if (!isComment(comment) || /^(?:\/\/!|\/\*!)/.test(comment.text)) {
          return "stop";
        }
        return /^(?:\/\/\/(?!\/)|\/\*\*(?!\*))/.test(comment.text) ? "include" : "skip";
      },
      clean: cleanComment,
    });
  },
};
