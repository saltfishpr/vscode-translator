import { cleanComment, isComment, readCommentBlock } from "../documentation";
import type { CommentLanguage } from "../types";

/** C# declarations and XML documentation comments. */
export const csharp: CommentLanguage = {
  grammar: "c-sharp",
  declarations: [
    "class_declaration",
    "struct_declaration",
    "interface_declaration",
    "record_declaration",
    "enum_declaration",
    "enum_member_declaration",
    "delegate_declaration",
    "method_declaration",
    "constructor_declaration",
    "property_declaration",
    "event_declaration",
    "variable_declarator",
  ],
  wrappers: ["variable_declaration", "field_declaration", "event_field_declaration"],
  documentation(node, text) {
    return readCommentBlock(node, text, {
      preceding(comment) {
        if (!isComment(comment)) {
          return "stop";
        }
        return /^(?:\/\/\/(?!\/)|\/\*\*)/.test(comment.text) ? "include" : "skip";
      },
      clean: cleanComment,
    });
  },
};
