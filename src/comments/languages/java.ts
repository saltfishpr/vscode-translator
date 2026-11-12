import { readJSDoc } from "../documentation";
import type { CommentLanguage } from "../types";

/** Java declarations and their closest Javadoc block. */
export const java: CommentLanguage = {
  grammar: "java",
  declarations: [
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "record_declaration",
    "annotation_type_declaration",
    "annotation_type_element_declaration",
    "method_declaration",
    "constructor_declaration",
    "compact_constructor_declaration",
    "variable_declarator",
    "enum_constant",
  ],
  wrappers: ["field_declaration", "constant_declaration", "local_variable_declaration"],
  documentation: readJSDoc,
};
