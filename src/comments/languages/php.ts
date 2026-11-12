import { declarationNames } from "../declarations";
import { readJSDoc } from "../documentation";
import type { CommentLanguage } from "../types";

/** PHP declarations and PHPDoc, including constant and property declaration wrappers. */
export const php: CommentLanguage = {
  grammar: "php",
  declarations: [
    "class_declaration",
    "interface_declaration",
    "trait_declaration",
    "enum_declaration",
    "enum_case",
    "function_definition",
    "method_declaration",
    "property_element",
    "const_element",
  ],
  wrappers: ["property_declaration", "const_declaration"],
  declarationNames(node) {
    if (node.type === "const_element") {
      const name = node.firstNamedChild;
      return name?.type === "name" ? [name] : [];
    }
    return declarationNames(node);
  },
  documentation: readJSDoc,
};
