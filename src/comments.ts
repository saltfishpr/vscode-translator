import { join } from 'node:path';
import { Language, Node, Parser, Tree } from '@vscode/tree-sitter-wasm';
import { commentLanguages } from './commentLanguages';

export interface SourceComment {
  text: string;
  identifiers: string[];
  style?: 'python';
}

const commentNodes = new Set(['comment', 'line_comment', 'block_comment']);
const identifierNodes = [
  'identifier', 'type_identifier', 'property_identifier', 'field_identifier',
  'name', 'variable_name', 'constant',
];

function declarationNames(node: Node, grammar: string): Node[] {
  if (
    node.type === 'shorthand_property_identifier' ||
    (node.type === 'property_identifier' && node.parent?.type === 'enum_body')
  ) {
    return [node];
  }
  if (grammar === 'ruby' && node.type === 'assignment') {
    const left = node.childForFieldName('left');
    return left?.type === 'constant' ? [left] : [];
  }
  if (grammar === 'ruby' && node.type === 'call') {
    const method = node.childForFieldName('method');
    return method && ['attr_reader', 'attr_writer', 'attr_accessor'].includes(method.text)
      ? (node.childForFieldName('arguments')?.namedChildren ?? []).filter(
          (child): child is Node => child?.type === 'simple_symbol'
        )
      : [];
  }
  if (grammar === 'php' && node.type === 'const_element') {
    const name = node.firstNamedChild;
    return name?.type === 'name' ? [name] : [];
  }
  if (grammar === 'cpp') {
    const declarators = node
      .childrenForFieldName('declarator')
      .filter((child): child is Node => child !== null);
    if (declarators.length) {
      return declarators.map((declarator) => {
        let name = declarator;
        for (;;) {
          const nested =
            name.childForFieldName('declarator') ??
            (name.type === 'parenthesized_declarator' ? name.firstNamedChild : null) ??
            (name.type === 'qualified_identifier' ? name.childForFieldName('name') : null);
          if (!nested) {
            return name;
          }
          name = nested;
        }
      });
    }
  }
  const field = node.type === 'pair' ? 'key' : node.type === 'field_definition' ? 'property' : 'name';
  const names = node.childrenForFieldName(field).filter((name): name is Node => name !== null);
  if (grammar === 'go' && node.type === 'field_declaration' && names.length === 0) {
    const embeddedType = node.childForFieldName('type');
    if (embeddedType) {
      names.push(embeddedType);
    }
  }
  return names;
}

function pythonDocstring(node: Node): string | undefined {
  const statement = node
    .childForFieldName('body')
    ?.namedChildren.find((child) => child && child.type !== 'comment');
  const value = statement?.type === 'expression_statement' ? statement.firstNamedChild : null;
  if (!value || !['string', 'concatenated_string'].includes(value.type)) {
    return;
  }
  const strings = value.type === 'string' ? [value] : value.namedChildren;
  const parts: string[] = [];
  for (const string of strings) {
    const match = string?.text.match(/^([ru]*)("""|'''|"|')([\s\S]*)\2$/i);
    if (!match) {
      return;
    }
    let body = match[3];
    if (!/r/i.test(match[1])) {
      body = body.replace(/\\(?:\r?\n|[\\'"abfnrtv]|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8})/g,
        (escape) => {
          const simple: Record<string, string> = {
            '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f',
            n: '\n', r: '\r', t: '\t', v: '\v',
          };
          if (/^\\\r?\n$/.test(escape)) {
            return '';
          }
          return escape[1] in simple
            ? simple[escape[1]]
            : String.fromCodePoint(Number.parseInt(escape.slice(2), 16));
        });
    }
    parts.push(body);
  }
  const lines = parts.join('').split(/\r?\n/).map((line) => line.replace(/\t/g, '        '));
  const indents = lines.slice(1).filter((line) => line.trim()).map((line) => line.match(/^ */)![0].length);
  const margin = indents.length ? Math.min(...indents) : 0;
  return [lines[0].trimStart(), ...lines.slice(1).map((line) => line.slice(margin))].join('\n').trim();
}

/** Extracts declaration-bound documentation without executing a language toolchain. */
export class CommentParser {
  private ready?: Promise<void>;
  private readonly parsers = new Map<string, Promise<Parser>>();
  private readonly trees = new Map<string, { version: number; language: string; tree: Tree }>();

  constructor(private readonly assetsPath: string) {}

  async read(
    uri: string,
    version: number,
    languageId: string,
    text: string,
    offset: number,
    atDeclarationStart = false
  ): Promise<SourceComment | undefined> {
    const rules = commentLanguages[languageId];
    if (!rules) {
      return;
    }
    const { grammar, style } = rules;
    let pendingParser = this.parsers.get(grammar);
    if (!pendingParser) {
      this.ready ??= Parser.init({ locateFile: (file) => join(this.assetsPath, file) });
      pendingParser = this.ready.then(async () => {
        const parser = new Parser();
        parser.setLanguage(await Language.load(join(this.assetsPath, `tree-sitter-${grammar}.wasm`)));
        return parser;
      });
      this.parsers.set(grammar, pendingParser);
    }
    const parser = await pendingParser;
    let cached = this.trees.get(uri);
    if (cached?.version !== version || cached.language !== grammar) {
      this.forget(uri);
      const tree = parser.parse(text);
      if (!tree) {
        return;
      }
      cached = { version, language: grammar, tree };
      this.trees.set(uri, cached);
      if (this.trees.size > 8) {
        this.forget(this.trees.keys().next().value!);
      }
    }

    let leaf = cached.tree.rootNode.namedDescendantForIndex(offset, offset);
    if (atDeclarationStart && leaf?.startIndex === offset) {
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
            child !== null &&
            (rules.declarations.includes(child.type) || !!rules.wrappers?.includes(child.type))
        );
        header = children.length === 1 ? children[0] : null;
      }
      const name =
        header && rules.declarations.includes(header.type)
          ? declarationNames(header, grammar)[0]
          : null;
      if (name) {
        offset = name.startIndex;
        leaf = cached.tree.rootNode.namedDescendantForIndex(offset, offset);
      }
    }
    for (let node: Node | null = leaf; node; node = node.parent) {
      const enumMember =
        style === 'jsdoc' &&
        node.type === 'property_identifier' &&
        node.parent?.type === 'enum_body';
      if (!rules.declarations.includes(node.type) && !enumMember) {
        continue;
      }
      const names = declarationNames(node, grammar);
      if (!names.some((name) => name.startIndex <= offset && offset < name.endIndex)) {
        continue;
      }

      const identifiers = names.map((name) => name.text);
      if (grammar === 'ruby') {
        identifiers.push(...identifiers.map((name) => name.replace(/^:/, '')));
      }
      const value = node.childForFieldName('value');
      if (value && ['arrow_function', 'function_expression'].includes(value.type)) {
        identifiers.push(
          ...(value.childForFieldName('parameters')?.descendantsOfType('identifier') ?? [])
            .filter((identifier): identifier is Node => identifier !== null)
            .map((identifier) => identifier.text)
        );
        const parameter = value.childForFieldName('parameter');
        if (parameter) {
          identifiers.push(parameter.text);
        }
      }
      const headers = [node];
      let declarator = node.childForFieldName('declarator');
      while (declarator) {
        headers.push(declarator);
        declarator = declarator.childForFieldName('declarator');
      }
      for (const headerNode of headers) {
        for (const field of [
          'parameters', 'receiver', 'type_parameters', 'return_type', 'result', 'returns',
        ]) {
          const header = headerNode.childForFieldName(field);
          if (header) {
            identifiers.push(
              ...header
                .descendantsOfType(identifierNodes)
                .filter((identifier): identifier is Node => identifier !== null)
                .map((identifier) => identifier.text)
            );
          }
        }
      }
      if (style === 'python') {
        const body = pythonDocstring(node);
        return body ? { text: body, identifiers: [...new Set(identifiers)], style: 'python' } : undefined;
      }
      for (let declaration: Node | null = node; declaration; ) {
        const comments: string[] = [];
        let start = declaration.startIndex;
        let previous = declaration.previousNamedSibling;
        while (
          previous &&
          (commentNodes.has(previous.type) ||
            (style === 'rust' && previous.type === 'attribute_item'))
        ) {
          const gap = text.slice(previous.endIndex, start);
          if (!/^\s*$/.test(gap) || (style === 'go' && (gap.match(/\n/g)?.length ?? 0) > 1)) {
            break;
          }
          if (style === 'rust' && previous.type === 'attribute_item') {
            start = previous.startIndex;
            previous = previous.previousNamedSibling;
            continue;
          }
          if (style === 'go' || style === 'ruby' || style === 'doxygen') {
            const lineStart = text.lastIndexOf('\n', previous.startIndex - 1) + 1;
            if (
              text.slice(lineStart, previous.startIndex).trim() &&
              (style !== 'doxygen' || previous.endPosition.row < declaration.startPosition.row)
            ) {
              break;
            }
            if (style === 'doxygen' && /^(?:\/\/[!/]*<|\/\*[*!]?<)/.test(previous.text)) {
              break;
            }
            comments.unshift(previous.text);
          } else if (style === 'jsdoc' && previous.text.startsWith('/**')) {
            comments.unshift(previous.text);
            break;
          } else if (style === 'xml' && /^(?:\/\/\/(?!\/)|\/\*\*)/.test(previous.text)) {
            comments.unshift(previous.text);
          } else if (style === 'rust') {
            if (/^(?:\/\/!|\/\*!)/.test(previous.text)) {
              break;
            }
            if (/^(?:\/\/\/(?!\/)|\/\*\*(?!\*))/.test(previous.text)) {
              comments.unshift(previous.text);
            }
          }
          start = previous.startIndex;
          previous = previous.previousNamedSibling;
        }
        if (comments.length === 0 && (style === 'go' || style === 'doxygen')) {
          const trailing = declaration.nextNamedSibling;
          if (
            trailing &&
            commentNodes.has(trailing.type) &&
            trailing.startPosition.row === declaration.endPosition.row
          ) {
            comments.push(trailing.text);
          }
        }
        if (comments.length > 0) {
          const body = comments
            .map((comment) => {
              comment = comment.replace(/\r?\n$/, '');
              if (style === 'ruby') {
                return comment.startsWith('=begin')
                  ? comment.replace(/^=begin[^\n]*\n/, '').replace(/\n=end[^\n]*$/, '')
                  : comment.replace(/^# ?/, '');
              }
              if (comment.startsWith('//')) {
                return style === 'go'
                  ? comment.slice(2).replace(/^ ?/, '')
                  : comment.replace(/^\/\/[!/]*<? ?/, '');
              }
              return comment
                .replace(/^\/\*[*!]?<?/, '')
                .replace(/\*\/$/, '')
                .split(/\r?\n/)
                .map((line) => line.replace(/^\s*\* ?/, ''))
                .join('\n');
            })
            .filter((comment) => style !== 'go' || !/^(?:go:|line |extern |export )/.test(comment))
            .filter((comment) => style !== 'ruby' || !/^(?:!|(?:coding|encoding)\s*[:=])/.test(comment))
            .join('\n')
            .trim();
          return body ? { text: body, identifiers: [...new Set(identifiers)] } : undefined;
        }
        const parent: Node | null = declaration.parent;
        declaration =
          parent && rules.wrappers?.includes(parent.type) &&
          (parent.type !== 'body_statement' || !declaration.previousNamedSibling)
            ? parent
            : null;
      }
      // A member without documentation must not inherit its enclosing type's comment.
      return;
    }
  }

  forget(uri: string) {
    this.trees.get(uri)?.tree.delete();
    this.trees.delete(uri);
  }

  dispose() {
    for (const uri of this.trees.keys()) {
      this.forget(uri);
    }
    for (const parser of this.parsers.values()) {
      void parser.then((value) => value.delete(), () => {});
    }
  }
}
