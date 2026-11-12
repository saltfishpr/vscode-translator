import * as assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { CommentParser, SourceComment } from '../comments';
import { commentLanguages } from '../commentLanguages';

const assetsPath = dirname(require.resolve('@vscode/tree-sitter-wasm'));

describe('CommentParser', () => {
  let parser: CommentParser;

  beforeEach(() => {
    parser = new CommentParser(assetsPath);
  });

  afterEach(() => {
    parser.dispose();
  });

  // The marker identifies the hover position without coupling fixtures to numeric offsets.
  function readComment(language: string, source: string, atDeclarationStart = false) {
    const offset = source.indexOf('↦');
    assert.notEqual(offset, -1, 'Fixture must mark the hover position');
    assert.equal(source.indexOf('↦', offset + 1), -1, 'Fixture must have exactly one marker');
    return parser.read('file:///fixture', 1, language, source.replace('↦', ''), offset, atDeclarationStart);
  }

  const fixtures: {
    name: string;
    language: string;
    source: string;
    expected: SourceComment;
  }[] = [
    {
      name: 'Go line comments and function signature identifiers',
      language: 'go',
      source: 'package p\n// Greet greets a user.\n// It returns a message.\nfunc ↦Greet(name string) string { return name }',
      expected: { text: 'Greet greets a user.\nIt returns a message.', identifiers: ['Greet', 'name', 'string'] },
    },
    {
      name: 'Go grouped declarations',
      language: 'go',
      source: 'package p\nconst (\n// Limit bounds the count.\n↦Limit = 10\n)',
      expected: { text: 'Limit bounds the count.', identifiers: ['Limit'] },
    },
    {
      name: 'Go type declaration wrapper',
      language: 'go',
      source: 'package p\n// User holds a name.\ntype ↦User struct { Name string }',
      expected: { text: 'User holds a name.', identifiers: ['User'] },
    },
    {
      name: 'Go embedded fields',
      language: 'go',
      source: 'package p\ntype User struct {\n// Reader reads input.\n↦Reader\n}',
      expected: { text: 'Reader reads input.', identifiers: ['Reader'] },
    },
    {
      name: 'Go same-line trailing comments',
      language: 'go',
      source: 'package p\nvar ↦Limit = 10 // Maximum count.',
      expected: { text: 'Maximum count.', identifiers: ['Limit'] },
    },
    {
      name: 'Go compiler directives are removed',
      language: 'go',
      source: 'package p\n// Run starts work.\n//go:noinline\nfunc ↦Run() {}',
      expected: { text: 'Run starts work.', identifiers: ['Run'] },
    },
    {
      name: 'TypeScript export and lexical declaration wrappers',
      language: 'typescript',
      source: '/** Maximum count. */\nexport const ↦limit = 10;',
      expected: { text: 'Maximum count.', identifiers: ['limit'] },
    },
    {
      name: 'TypeScript ambient declaration wrapper',
      language: 'typescript',
      source: '/** Starts work. */\ndeclare function ↦run(): void;',
      expected: { text: 'Starts work.', identifiers: ['run'] },
    },
    {
      name: 'TypeScript multiline JSDoc and deduplicated signature identifiers',
      language: 'typescript',
      source: '/**\n * Looks up a value.\n * @param value Input value.\n */\nfunction ↦lookup<T>(value: T): T { return value; }',
      expected: { text: 'Looks up a value.\n@param value Input value.', identifiers: ['lookup', 'value', 'T'] },
    },
    {
      name: 'TypeScript arrow function parameters',
      language: 'typescript',
      source: '/** Adds values. */\nconst ↦add = (left: number, right: number) => left + right;',
      expected: { text: 'Adds values.', identifiers: ['add', 'left', 'right'] },
    },
    {
      name: 'TypeScript enum members without initializers',
      language: 'typescript',
      source: 'enum Status {\n/** Work is done. */\n↦Done\n}',
      expected: { text: 'Work is done.', identifiers: ['Done'] },
    },
    {
      name: 'TypeScript object property keys',
      language: 'typescript',
      source: 'const settings = {\n/** Maximum count. */\n↦limit: 10\n};',
      expected: { text: 'Maximum count.', identifiers: ['limit'] },
    },
    {
      name: 'TypeScript shorthand properties',
      language: 'typescript',
      source: 'const settings = {\n/** Maximum count. */\n↦limit\n};',
      expected: { text: 'Maximum count.', identifiers: ['limit'] },
    },
    {
      name: 'TSX declarations with JSX bodies',
      language: 'typescriptreact',
      source: '/** Renders a greeting. */\nexport function ↦Greeting() { return <div>Hello</div>; }',
      expected: { text: 'Renders a greeting.', identifiers: ['Greeting'] },
    },
    {
      name: 'JavaScript single-parameter arrow functions',
      language: 'javascript',
      source: '/** Returns the input. */\nconst ↦identity = value => value;',
      expected: { text: 'Returns the input.', identifiers: ['identity', 'value'] },
    },
    {
      name: 'JavaScript React language alias',
      language: 'javascriptreact',
      source: '/** Renders a greeting. */\nfunction ↦Greeting() { return <div>Hello</div>; }',
      expected: { text: 'Renders a greeting.', identifiers: ['Greeting'] },
    },
    {
      name: 'Python decorated functions and docstring dedentation',
      language: 'python',
      source: '@cached\ndef ↦greet(name):\n    """Greet a user.\n\n    Args:\n        name: User name.\n    """\n    return name',
      expected: { text: 'Greet a user.\n\nArgs:\n    name: User name.', identifiers: ['greet', 'name'], style: 'python' },
    },
    {
      name: 'Python class docstrings after comments',
      language: 'python',
      source: 'class ↦User:\n    # Internal note.\n    """A user record."""\n    pass',
      expected: { text: 'A user record.', identifiers: ['User'], style: 'python' },
    },
    {
      name: 'Python adjacent string literals and escape decoding',
      language: 'python',
      source: 'def ↦read():\n    "First\\n" "Second\\t\\u0041"',
      expected: { text: 'First\nSecond        A', identifiers: ['read'], style: 'python' },
    },
    {
      name: 'Python raw docstrings preserve escapes',
      language: 'python',
      source: 'def ↦read():\n    r"""Keep \\n literal."""',
      expected: { text: 'Keep \\n literal.', identifiers: ['read'], style: 'python' },
    },
    {
      name: 'Java field declaration wrapper',
      language: 'java',
      source: 'class User {\n/** Display name. */\nprivate String ↦name;\n}',
      expected: { text: 'Display name.', identifiers: ['name'] },
    },
    {
      name: 'C language alias and function declarator names',
      language: 'c',
      source: '/** Adds values. */\nint ↦add(int left, int right) { return left + right; }',
      expected: { text: 'Adds values.', identifiers: ['add', 'left', 'right'] },
    },
    {
      name: 'C++ template wrapper',
      language: 'cpp',
      source: '/** Stores a value. */\ntemplate <typename T> class ↦Box {};',
      expected: { text: 'Stores a value.', identifiers: ['Box'] },
    },
    {
      name: 'C++ qualified function declarators',
      language: 'cpp',
      source: '/// Starts work.\nvoid Worker::↦run() {}',
      expected: { text: 'Starts work.', identifiers: ['run'] },
    },
    {
      name: 'C++ trailing Doxygen comments',
      language: 'cpp',
      source: 'struct Config {\nint ↦limit; ///< Maximum count.\n};',
      expected: { text: 'Maximum count.', identifiers: ['limit'] },
    },
    {
      name: 'C# XML comments across field wrappers',
      language: 'csharp',
      source: 'class User {\n/// <summary>Display name.</summary>\npublic string ↦Name;\n}',
      expected: { text: '<summary>Display name.</summary>', identifiers: ['Name'] },
    },
    {
      name: 'Rust attributes between documentation and declarations',
      language: 'rust',
      source: '/// A user record.\n#[derive(Debug)]\n/// Used for display.\npub struct ↦User {}',
      expected: { text: 'A user record.\nUsed for display.', identifiers: ['User'] },
    },
    {
      name: 'Rust block documentation',
      language: 'rust',
      source: '/** Starts work. */\nfn ↦run() {}',
      expected: { text: 'Starts work.', identifiers: ['run'] },
    },
    {
      name: 'PHP property wrapper',
      language: 'php',
      source: '<?php\nclass User {\n/** Display name. */\npublic string $↦name;\n}',
      expected: { text: 'Display name.', identifiers: ['$name'] },
    },
    {
      name: 'PHP constant names',
      language: 'php',
      source: '<?php\n/** Maximum count. */\nconst ↦LIMIT = 10;',
      expected: { text: 'Maximum count.', identifiers: ['LIMIT'] },
    },
    {
      name: 'Ruby line comments and method parameters',
      language: 'ruby',
      source: '# Greets a user.\n# Returns a message.\ndef ↦greet(name)\n  name\nend',
      expected: { text: 'Greets a user.\nReturns a message.', identifiers: ['greet', 'name'] },
    },
    {
      name: 'Ruby block comments',
      language: 'ruby',
      source: '=begin\nA user record.\n=end\nclass ↦User\nend',
      expected: { text: 'A user record.', identifiers: ['User'] },
    },
    {
      name: 'Ruby constants and directive filtering',
      language: 'ruby',
      source: '# encoding: utf-8\n# Maximum count.\n↦LIMIT = 10',
      expected: { text: 'Maximum count.', identifiers: ['LIMIT'] },
    },
    {
      name: 'Ruby attribute symbols and normalized identifiers',
      language: 'ruby',
      source: 'class User\n# Display names.\nattr_reader :↦name, :email\nend',
      expected: { text: 'Display names.', identifiers: [':name', ':email', 'name', 'email'] },
    },
    {
      name: 'CRLF and non-ASCII documentation',
      language: 'typescript',
      source: '/**\r\n * 用户名称。\r\n */\r\nconst ↦name = "用户";',
      expected: { text: '用户名称。', identifiers: ['name'] },
    },
  ];

  for (const fixture of fixtures) {
    it(`extracts ${fixture.name}`, async () => {
      assert.deepEqual(await readComment(fixture.language, fixture.source), fixture.expected);
    });
  }

  it('extracts parenthesized Python docstrings', {
    todo: 'pythonDocstring does not unwrap parenthesized_expression yet',
  }, async () => {
    assert.deepEqual(
      await readComment('python', 'def ↦read():\n    ("First\\n" "Second")'),
      { text: 'First\nSecond', identifiers: ['read'], style: 'python' }
    );
  });

  it('covers every registered language with an extraction fixture', () => {
    assert.deepEqual(
      [...new Set(fixtures.map((fixture) => fixture.language))].sort(),
      Object.keys(commentLanguages).sort()
    );
  });

  const ignored: { name: string; language: string; source: string }[] = [
    { name: 'unsupported languages', language: 'plaintext', source: '/** Docs. */\nconst ↦value = 1;' },
    { name: 'declarations without documentation', language: 'typescript', source: 'const ↦value = 1;' },
    { name: 'ordinary JavaScript line comments', language: 'javascript', source: '// Docs.\nconst ↦value = 1;' },
    { name: 'ordinary JavaScript block comments', language: 'javascript', source: '/* Docs. */\nconst ↦value = 1;' },
    { name: 'empty documentation', language: 'typescript', source: '/**\n *\n */\nconst ↦value = 1;' },
    { name: 'references to documented symbols', language: 'typescript', source: '/** Docs. */\nconst value = 1;\nconsole.log(↦value);' },
    { name: 'parameter names rather than declaration names', language: 'typescript', source: '/** Docs. */\nfunction greet(↦name: string) {}' },
    { name: 'declaration keywords by default', language: 'typescript', source: '/** Docs. */\n↦export const value = 1;' },
    { name: 'undocumented members inside documented classes', language: 'typescript', source: '/** Class docs. */\nclass User {\n↦name: string;\n}' },
    { name: 'Go comments separated by blank lines', language: 'go', source: 'package p\n// Docs.\n\nfunc ↦Run() {}' },
    { name: 'Go trailing comments belonging to the previous declaration', language: 'go', source: 'package p\nvar first = 1 // First docs.\nvar ↦second = 2' },
    { name: 'Go directives without prose', language: 'go', source: 'package p\n//go:noinline\nfunc ↦Run() {}' },
    { name: 'Python comments instead of docstrings', language: 'python', source: '# Docs.\ndef ↦run():\n    pass' },
    { name: 'Python strings after another statement', language: 'python', source: 'def ↦run():\n    value = 1\n    """Not a docstring."""' },
    { name: 'Python interpolated strings', language: 'python', source: 'def ↦run():\n    f"""Not a docstring."""' },
    { name: 'Python byte strings', language: 'python', source: 'def ↦run():\n    b"""Not a docstring."""' },
    { name: 'C++ trailing documentation belonging to the previous field', language: 'cpp', source: 'struct Config {\nint first; ///< First docs.\nint ↦second;\n};' },
    { name: 'ordinary C# comments', language: 'csharp', source: '// Docs.\nclass ↦User {}' },
    { name: 'Rust inner line documentation', language: 'rust', source: '//! Module docs.\nfn ↦run() {}' },
    { name: 'Rust inner block documentation', language: 'rust', source: '/*! Module docs. */\nfn ↦run() {}' },
    { name: 'ordinary Rust comments', language: 'rust', source: '// Docs.\nfn ↦run() {}' },
    { name: 'Rust four-slash comments', language: 'rust', source: '//// Not documentation.\nfn ↦run() {}' },
    { name: 'Ruby non-constant assignments', language: 'ruby', source: '# Docs.\n↦value = 1' },
    { name: 'Ruby calls other than attribute declarations', language: 'ruby', source: '# Docs.\n↦puts "Hello"' },
    { name: 'Ruby shebang and encoding comments without prose', language: 'ruby', source: '#!/usr/bin/env ruby\n# coding: utf-8\nclass ↦User\nend' },
  ];

  for (const fixture of ignored) {
    it(`ignores ${fixture.name}`, async () => {
      assert.equal(await readComment(fixture.language, fixture.source), undefined);
    });
  }

  it('uses the nearest JSDoc block instead of merging unrelated blocks', async () => {
    assert.deepEqual(
      await readComment('typescript', '/** Older docs. */\n/** Current docs. */\nconst ↦value = 1;'),
      { text: 'Current docs.', identifiers: ['value'] }
    );
  });

  it('does not use preceding documentation across another declaration', async () => {
    assert.equal(
      await readComment('typescript', '/** First docs. */\nconst first = 1;\nconst ↦second = 2;'),
      undefined
    );
  });

  it('accepts hover positions inside declaration names', async () => {
    assert.deepEqual(
      await readComment('typescript', '/** Docs. */\nconst va↦lue = 1;'),
      { text: 'Docs.', identifiers: ['value'] }
    );
  });

  it('does not match the exclusive end of a declaration name', async () => {
    assert.equal(await readComment('typescript', '/** Docs. */\nconst value↦ = 1;'), undefined);
  });

  it('resolves declaration starts through multiple wrappers when requested', async () => {
    assert.deepEqual(
      await readComment('typescript', '/** Docs. */\n↦export const value = 1;', true),
      { text: 'Docs.', identifiers: ['value'] }
    );
  });

  it('resolves decorated Python declaration starts when requested', async () => {
    assert.deepEqual(
      await readComment('python', '↦@cached\ndef run():\n    """Starts work."""', true),
      { text: 'Starts work.', identifiers: ['run'], style: 'python' }
    );
  });

  it('does not choose a declaration from an ambiguous wrapper', async () => {
    assert.equal(
      await readComment('typescript', '/** Docs. */\n↦const first = 1, second = 2;', true),
      undefined
    );
  });

  it('returns the same extraction on repeated reads of an unchanged document', async () => {
    const source = '/** Docs. */\nconst value = 1;';
    const offset = source.indexOf('value');
    const expected = { text: 'Docs.', identifiers: ['value'] };
    assert.deepEqual(await parser.read('file:///cached', 1, 'typescript', source, offset), expected);
    assert.deepEqual(await parser.read('file:///cached', 1, 'typescript', source, offset), expected);
  });

  it('refreshes documentation when a document version changes', async () => {
    const first = '/** First docs. */\nconst value = 1;';
    const second = '/** Updated docs. */\nconst value = 1;';
    await parser.read('file:///cached', 1, 'typescript', first, first.indexOf('value'));
    assert.deepEqual(
      await parser.read('file:///cached', 2, 'typescript', second, second.indexOf('value')),
      { text: 'Updated docs.', identifiers: ['value'] }
    );
  });

  it('reparses a document when its language changes at the same version', async () => {
    const typescript = '/** TypeScript docs. */\nconst value = 1;';
    await parser.read('file:///cached', 1, 'typescript', typescript, typescript.indexOf('value'));
    const python = 'def run():\n    """Python docs."""';
    assert.deepEqual(
      await parser.read('file:///cached', 1, 'python', python, python.indexOf('run')),
      { text: 'Python docs.', identifiers: ['run'], style: 'python' }
    );
  });

  it('keeps documentation isolated between documents with the same version', async () => {
    const first = '/** First docs. */\nconst value = 1;';
    const second = '/** Second docs. */\nconst value = 1;';
    await parser.read('file:///first', 1, 'typescript', first, first.indexOf('value'));
    assert.deepEqual(
      await parser.read('file:///second', 1, 'typescript', second, second.indexOf('value')),
      { text: 'Second docs.', identifiers: ['value'] }
    );
    assert.deepEqual(
      await parser.read('file:///first', 1, 'typescript', first, first.indexOf('value')),
      { text: 'First docs.', identifiers: ['value'] }
    );
  });

  it('allows forgotten documents to be parsed again at the same version', async () => {
    const first = '/** First docs. */\nconst value = 1;';
    await parser.read('file:///cached', 1, 'typescript', first, first.indexOf('value'));
    parser.forget('file:///cached');
    const second = '/** New docs. */\nconst value = 1;';
    assert.deepEqual(
      await parser.read('file:///cached', 1, 'typescript', second, second.indexOf('value')),
      { text: 'New docs.', identifiers: ['value'] }
    );
  });

  it('can reread documents after exceeding the tree cache capacity', async () => {
    for (let index = 0; index < 10; index++) {
      const source = `/** Document ${index}. */\nconst value = ${index};`;
      assert.deepEqual(
        await parser.read(`file:///cache-${index}`, 1, 'typescript', source, source.indexOf('value')),
        { text: `Document ${index}.`, identifiers: ['value'] }
      );
    }
    const source = '/** Document 0. */\nconst value = 0;';
    assert.deepEqual(
      await parser.read('file:///cache-0', 1, 'typescript', source, source.indexOf('value')),
      { text: 'Document 0.', identifiers: ['value'] }
    );
  });
});
