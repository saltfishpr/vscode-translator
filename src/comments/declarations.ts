import { Node } from "@vscode/tree-sitter-wasm";
import type { CommentLanguage, DocumentationTarget } from "./types";

/** Returns the named declaration nodes stored in a grammar's name field. */
export function declarationNames(node: Node): Node[] {
  return node.childrenForFieldName("name").filter((name): name is Node => name !== null);
}

/**
 * Finds the declaration whose name contains the offset, optionally accepting declaration starts.
 * Wrapper starts must identify one declaration. The returned node belongs to the caller's tree.
 */
export function findDeclaration(root: Node, rules: CommentLanguage, target: DocumentationTarget): Node | undefined {
  const namesFor = rules.declarationNames ?? declarationNames;
  let { offset } = target;
  let leaf = root.namedDescendantForIndex(offset, offset);
  if (target.match === "name-or-declaration-start" && leaf?.startIndex === offset) {
    let header: Node | null = leaf;
    while (
      header?.parent?.startIndex === offset &&
      !rules.declarations.includes(header.type) &&
      !rules.wrappers?.includes(header.type)
    ) {
      header = header.parent;
    }
    while (header && rules.wrappers?.includes(header.type)) {
      const children: Node[] = header.namedChildren.filter(
        (child): child is Node =>
          child !== null && (rules.declarations.includes(child.type) || !!rules.wrappers?.includes(child.type)),
      );
      header = children.length === 1 ? children[0] : null;
    }
    const name = header && rules.declarations.includes(header.type) ? namesFor(header)[0] : null;
    if (name) {
      offset = name.startIndex;
      leaf = root.namedDescendantForIndex(offset, offset);
    }
  }
  for (let node: Node | null = leaf; node; node = node.parent) {
    if (!rules.declarations.includes(node.type)) {
      continue;
    }
    const names = namesFor(node);
    if (!names.some((name) => name.startIndex <= offset && offset < name.endIndex)) {
      continue;
    }
    return node;
  }
}
