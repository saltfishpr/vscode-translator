import type { CommentLanguage } from "../types";

/** Python class and function docstrings, decoded without executing Python. */
export const python: CommentLanguage = {
  grammar: "python",
  declarations: ["function_definition", "class_definition"],
  wrappers: ["decorated_definition"],
  documentation(node) {
    const statement = node.childForFieldName("body")?.namedChildren.find((child) => child && child.type !== "comment");
    const value = statement?.type === "expression_statement" ? statement.firstNamedChild : null;
    if (!value || !["string", "concatenated_string"].includes(value.type)) {
      return;
    }
    const strings = value.type === "string" ? [value] : value.namedChildren;
    const parts: string[] = [];
    for (const string of strings) {
      const match = string?.text.match(/^([ru]*)("""|'''|"|')([\s\S]*)\2$/i);
      if (!match) {
        return;
      }
      let body = match[3];
      if (!/r/i.test(match[1])) {
        body = body.replace(/\\(?:\r?\n|[\\'"abfnrtv]|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8})/g, (escape) => {
          const simple: Record<string, string> = {
            "\\": "\\",
            "'": "'",
            '"': '"',
            a: "\x07",
            b: "\b",
            f: "\f",
            n: "\n",
            r: "\r",
            t: "\t",
            v: "\v",
          };
          if (/^\\\r?\n$/.test(escape)) {
            return "";
          }
          return escape[1] in simple ? simple[escape[1]] : String.fromCodePoint(Number.parseInt(escape.slice(2), 16));
        });
      }
      parts.push(body);
    }
    const lines = parts
      .join("")
      .split(/\r?\n/)
      .map((line) => line.replace(/\t/g, "        "));
    const indents = lines
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => line.match(/^ */)![0].length);
    const margin = indents.length ? Math.min(...indents) : 0;
    return [lines[0].trimStart(), ...lines.slice(1).map((line) => line.slice(margin))].join("\n").trim();
  },
};
