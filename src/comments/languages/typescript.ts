import { Node } from "@vscode/tree-sitter-wasm";
import { declarationNames } from "../declarations";
import { readJSDoc } from "../documentation";
import type { CommentLanguage } from "../types";

/** TypeScript declarations and JSDoc, shared with JavaScript and JSX grammars. */
export const typescript: CommentLanguage = {
  grammar: "typescript",
  declarations: [
    "function_declaration",
    "function_signature",
    "class_declaration",
    "abstract_class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "enum_assignment",
    "variable_declarator",
    "method_definition",
    "method_signature",
    "abstract_method_signature",
    "public_field_definition",
    "property_signature",
    "field_definition",
    "pair",
    "shorthand_property_identifier",
    "property_identifier",
  ],
  wrappers: ["export_statement", "ambient_declaration", "lexical_declaration", "variable_declaration"],
  declarationNames(node) {
    if (node.type === "shorthand_property_identifier") {
      return [node];
    }
    if (node.type === "property_identifier") {
      return node.parent?.type === "enum_body" ? [node] : [];
    }
    if (node.type === "pair" || node.type === "field_definition") {
      const field = node.type === "pair" ? "key" : "property";
      return node.childrenForFieldName(field).filter((name): name is Node => name !== null);
    }
    return declarationNames(node);
  },
  documentation: readJSDoc,
};

/** TypeScript declaration rules with the TSX grammar. */
export const tsx: CommentLanguage = { ...typescript, grammar: "tsx" };

/** JavaScript and JSX use the same declaration and JSDoc rules as TypeScript. */
export const javascript: CommentLanguage = { ...typescript, grammar: "javascript" };
