import * as assert from "node:assert/strict";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { CommentExtractor } from "../comments/parser";
import type { DocumentationTarget } from "../comments/types";
import { commentLanguages } from "../comments/languages";

const assetsPath = dirname(require.resolve("@vscode/tree-sitter-wasm"));

describe("CommentExtractor", () => {
  let extractor: CommentExtractor;

  beforeEach(() => {
    extractor = new CommentExtractor(assetsPath);
  });

  afterEach(() => {
    extractor.dispose();
  });

  // The marker identifies the hover position without coupling fixtures to numeric offsets.
  function readComment(languageId: string, source: string, match: DocumentationTarget["match"] = "name") {
    const offset = source.indexOf("↦");
    assert.notEqual(offset, -1, "Fixture must mark the hover position");
    assert.equal(source.indexOf("↦", offset + 1), -1, "Fixture must have exactly one marker");
    return extractor.extract({ languageId, text: source.replace("↦", "") }, { offset, match });
  }

  const fixtures: {
    name: string;
    language: string;
    source: string;
    expected: string;
  }[] = [
    {
      name: "Go line comments",
      language: "go",
      source:
        "package p\n// Greet greets a user.\n// It returns a message.\nfunc ↦Greet(name string) string { return name }",
      expected: "Greet greets a user.\nIt returns a message.",
    },
    {
      name: "Go grouped declarations",
      language: "go",
      source: "package p\nconst (\n// Limit bounds the count.\n↦Limit = 10\n)",
      expected: "Limit bounds the count.",
    },
    {
      name: "Go type declaration wrapper",
      language: "go",
      source: "package p\n// User holds a name.\ntype ↦User struct { Name string }",
      expected: "User holds a name.",
    },
    {
      name: "Go embedded fields",
      language: "go",
      source: "package p\ntype User struct {\n// Reader reads input.\n↦Reader\n}",
      expected: "Reader reads input.",
    },
    {
      name: "Go same-line trailing comments",
      language: "go",
      source: "package p\nvar ↦Limit = 10 // Maximum count.",
      expected: "Maximum count.",
    },
    {
      name: "Go compiler directives are removed",
      language: "go",
      source: "package p\n// Run starts work.\n//go:noinline\nfunc ↦Run() {}",
      expected: "Run starts work.",
    },
    {
      name: "TypeScript export and lexical declaration wrappers",
      language: "typescript",
      source: "/** Maximum count. */\nexport const ↦limit = 10;",
      expected: "Maximum count.",
    },
    {
      name: "TypeScript ambient declaration wrapper",
      language: "typescript",
      source: "/** Starts work. */\ndeclare function ↦run(): void;",
      expected: "Starts work.",
    },
    {
      name: "TypeScript multiline JSDoc with parameter tags",
      language: "typescript",
      source:
        "/**\n * Looks up a value.\n * @param value Input value.\n */\nfunction ↦lookup<T>(value: T): T { return value; }",
      expected: "Looks up a value.\n@param value Input value.",
    },
    {
      name: "TypeScript arrow functions",
      language: "typescript",
      source: "/** Adds values. */\nconst ↦add = (left: number, right: number) => left + right;",
      expected: "Adds values.",
    },
    {
      name: "TypeScript enum members without initializers",
      language: "typescript",
      source: "enum Status {\n/** Work is done. */\n↦Done\n}",
      expected: "Work is done.",
    },
    {
      name: "TypeScript object property keys",
      language: "typescript",
      source: "const settings = {\n/** Maximum count. */\n↦limit: 10\n};",
      expected: "Maximum count.",
    },
    {
      name: "TypeScript shorthand properties",
      language: "typescript",
      source: "const settings = {\n/** Maximum count. */\n↦limit\n};",
      expected: "Maximum count.",
    },
    {
      name: "TSX declarations with JSX bodies",
      language: "typescriptreact",
      source: "/** Renders a greeting. */\nexport function ↦Greeting() { return <div>Hello</div>; }",
      expected: "Renders a greeting.",
    },
    {
      name: "JavaScript single-parameter arrow functions",
      language: "javascript",
      source: "/** Returns the input. */\nconst ↦identity = value => value;",
      expected: "Returns the input.",
    },
    {
      name: "JavaScript React language alias",
      language: "javascriptreact",
      source: "/** Renders a greeting. */\nfunction ↦Greeting() { return <div>Hello</div>; }",
      expected: "Renders a greeting.",
    },
    {
      name: "Python decorated functions and docstring dedentation",
      language: "python",
      source:
        '@cached\ndef ↦greet(name):\n    """Greet a user.\n\n    Args:\n        name: User name.\n    """\n    return name',
      expected: "Greet a user.\n\nArgs:\n    name: User name.",
    },
    {
      name: "Python class docstrings after comments",
      language: "python",
      source: 'class ↦User:\n    # Internal note.\n    """A user record."""\n    pass',
      expected: "A user record.",
    },
    {
      name: "Python adjacent string literals and escape decoding",
      language: "python",
      source: 'def ↦read():\n    "First\\n" "Second\\t\\u0041"',
      expected: "First\nSecond        A",
    },
    {
      name: "Python raw docstrings preserve escapes",
      language: "python",
      source: 'def ↦read():\n    r"""Keep \\n literal."""',
      expected: "Keep \\n literal.",
    },
    {
      name: "Java field declaration wrapper",
      language: "java",
      source: "class User {\n/** Display name. */\nprivate String ↦name;\n}",
      expected: "Display name.",
    },
    {
      name: "C language alias and function declarator names",
      language: "c",
      source: "/** Adds values. */\nint ↦add(int left, int right) { return left + right; }",
      expected: "Adds values.",
    },
    {
      name: "C++ template wrapper",
      language: "cpp",
      source: "/** Stores a value. */\ntemplate <typename T> class ↦Box {};",
      expected: "Stores a value.",
    },
    {
      name: "C++ qualified function declarators",
      language: "cpp",
      source: "/// Starts work.\nvoid Worker::↦run() {}",
      expected: "Starts work.",
    },
    {
      name: "C++ trailing Doxygen comments",
      language: "cpp",
      source: "struct Config {\nint ↦limit; ///< Maximum count.\n};",
      expected: "Maximum count.",
    },
    {
      name: "C# XML comments across field wrappers",
      language: "csharp",
      source: "class User {\n/// <summary>Display name.</summary>\npublic string ↦Name;\n}",
      expected: "<summary>Display name.</summary>",
    },
    {
      name: "Rust attributes between documentation and declarations",
      language: "rust",
      source: "/// A user record.\n#[derive(Debug)]\n/// Used for display.\npub struct ↦User {}",
      expected: "A user record.\nUsed for display.",
    },
    {
      name: "Rust block documentation",
      language: "rust",
      source: "/** Starts work. */\nfn ↦run() {}",
      expected: "Starts work.",
    },
    {
      name: "PHP property wrapper",
      language: "php",
      source: "<?php\nclass User {\n/** Display name. */\npublic string $↦name;\n}",
      expected: "Display name.",
    },
    {
      name: "PHP constant names",
      language: "php",
      source: "<?php\n/** Maximum count. */\nconst ↦LIMIT = 10;",
      expected: "Maximum count.",
    },
    {
      name: "Ruby line comments on methods",
      language: "ruby",
      source: "# Greets a user.\n# Returns a message.\ndef ↦greet(name)\n  name\nend",
      expected: "Greets a user.\nReturns a message.",
    },
    {
      name: "Ruby block comments",
      language: "ruby",
      source: "=begin\nA user record.\n=end\nclass ↦User\nend",
      expected: "A user record.",
    },
    {
      name: "Ruby constants and directive filtering",
      language: "ruby",
      source: "# encoding: utf-8\n# Maximum count.\n↦LIMIT = 10",
      expected: "Maximum count.",
    },
    {
      name: "Ruby attribute symbols",
      language: "ruby",
      source: "class User\n# Display names.\nattr_reader :↦name, :email\nend",
      expected: "Display names.",
    },
    {
      name: "CRLF and non-ASCII documentation",
      language: "typescript",
      source: '/**\r\n * 用户名称。\r\n */\r\nconst ↦name = "用户";',
      expected: "用户名称。",
    },
  ];

  for (const fixture of fixtures) {
    it(`extracts ${fixture.name}`, async () => {
      assert.equal(await readComment(fixture.language, fixture.source), fixture.expected);
    });
  }

  it(
    "extracts parenthesized Python docstrings",
    {
      todo: "pythonDocstring does not unwrap parenthesized_expression yet",
    },
    async () => {
      assert.equal(await readComment("python", 'def ↦read():\n    ("First\\n" "Second")'), "First\nSecond");
    },
  );

  it("covers every registered language with an extraction fixture", () => {
    assert.deepEqual(
      [...new Set(fixtures.map((fixture) => fixture.language))].sort(),
      Object.keys(commentLanguages).sort(),
    );
  });

  const ignored: { name: string; language: string; source: string }[] = [
    { name: "unsupported languages", language: "plaintext", source: "/** Docs. */\nconst ↦value = 1;" },
    { name: "declarations without documentation", language: "typescript", source: "const ↦value = 1;" },
    { name: "ordinary JavaScript line comments", language: "javascript", source: "// Docs.\nconst ↦value = 1;" },
    { name: "ordinary JavaScript block comments", language: "javascript", source: "/* Docs. */\nconst ↦value = 1;" },
    { name: "empty documentation", language: "typescript", source: "/**\n *\n */\nconst ↦value = 1;" },
    {
      name: "references to documented symbols",
      language: "typescript",
      source: "/** Docs. */\nconst value = 1;\nconsole.log(↦value);",
    },
    {
      name: "parameter names rather than declaration names",
      language: "typescript",
      source: "/** Docs. */\nfunction greet(↦name: string) {}",
    },
    {
      name: "declaration keywords by default",
      language: "typescript",
      source: "/** Docs. */\n↦export const value = 1;",
    },
    {
      name: "undocumented members inside documented classes",
      language: "typescript",
      source: "/** Class docs. */\nclass User {\n↦name: string;\n}",
    },
    { name: "Go comments separated by blank lines", language: "go", source: "package p\n// Docs.\n\nfunc ↦Run() {}" },
    {
      name: "Go trailing comments belonging to the previous declaration",
      language: "go",
      source: "package p\nvar first = 1 // First docs.\nvar ↦second = 2",
    },
    { name: "Go directives without prose", language: "go", source: "package p\n//go:noinline\nfunc ↦Run() {}" },
    { name: "Python comments instead of docstrings", language: "python", source: "# Docs.\ndef ↦run():\n    pass" },
    {
      name: "Python strings after another statement",
      language: "python",
      source: 'def ↦run():\n    value = 1\n    """Not a docstring."""',
    },
    { name: "Python interpolated strings", language: "python", source: 'def ↦run():\n    f"""Not a docstring."""' },
    { name: "Python byte strings", language: "python", source: 'def ↦run():\n    b"""Not a docstring."""' },
    {
      name: "C++ trailing documentation belonging to the previous field",
      language: "cpp",
      source: "struct Config {\nint first; ///< First docs.\nint ↦second;\n};",
    },
    { name: "ordinary C# comments", language: "csharp", source: "// Docs.\nclass ↦User {}" },
    { name: "Rust inner line documentation", language: "rust", source: "//! Module docs.\nfn ↦run() {}" },
    { name: "Rust inner block documentation", language: "rust", source: "/*! Module docs. */\nfn ↦run() {}" },
    { name: "ordinary Rust comments", language: "rust", source: "// Docs.\nfn ↦run() {}" },
    { name: "Rust four-slash comments", language: "rust", source: "//// Not documentation.\nfn ↦run() {}" },
    { name: "Ruby non-constant assignments", language: "ruby", source: "# Docs.\n↦value = 1" },
    { name: "Ruby calls other than attribute declarations", language: "ruby", source: '# Docs.\n↦puts "Hello"' },
    {
      name: "Ruby shebang and encoding comments without prose",
      language: "ruby",
      source: "#!/usr/bin/env ruby\n# coding: utf-8\nclass ↦User\nend",
    },
  ];

  for (const fixture of ignored) {
    it(`ignores ${fixture.name}`, async () => {
      assert.equal(await readComment(fixture.language, fixture.source), undefined);
    });
  }

  it("uses the nearest JSDoc block instead of merging unrelated blocks", async () => {
    assert.equal(
      await readComment("typescript", "/** Older docs. */\n/** Current docs. */\nconst ↦value = 1;"),
      "Current docs.",
    );
  });

  it("does not use preceding documentation across another declaration", async () => {
    assert.equal(
      await readComment("typescript", "/** First docs. */\nconst first = 1;\nconst ↦second = 2;"),
      undefined,
    );
  });

  it("accepts hover positions inside declaration names", async () => {
    assert.equal(await readComment("typescript", "/** Docs. */\nconst va↦lue = 1;"), "Docs.");
  });

  it("does not match the exclusive end of a declaration name", async () => {
    assert.equal(await readComment("typescript", "/** Docs. */\nconst value↦ = 1;"), undefined);
  });

  it("resolves declaration starts through multiple wrappers when requested", async () => {
    assert.equal(
      await readComment("typescript", "/** Docs. */\n↦export const value = 1;", "name-or-declaration-start"),
      "Docs.",
    );
  });

  it("resolves decorated Python declaration starts when requested", async () => {
    assert.equal(
      await readComment("python", '↦@cached\ndef run():\n    """Starts work."""', "name-or-declaration-start"),
      "Starts work.",
    );
  });

  it("does not choose a declaration from an ambiguous wrapper", async () => {
    assert.equal(
      await readComment("typescript", "/** Docs. */\n↦const first = 1, second = 2;", "name-or-declaration-start"),
      undefined,
    );
  });

  it("returns the same extraction on repeated reads of unchanged source", async () => {
    const source = { languageId: "typescript", text: "/** Docs. */\nconst value = 1;" };
    const target = { offset: source.text.indexOf("value"), match: "name" } as const;
    assert.equal(await extractor.extract(source, target), "Docs.");
    assert.equal(await extractor.extract(source, target), "Docs.");
  });

  it("refreshes documentation when source text changes", async () => {
    assert.equal(await readComment("typescript", "/** First docs. */\nconst ↦value = 1;"), "First docs.");
    assert.equal(await readComment("typescript", "/** Updated docs. */\nconst ↦value = 1;"), "Updated docs.");
  });

  it("extracts documentation when the source language changes", async () => {
    assert.equal(await readComment("typescript", "/** TypeScript docs. */\nconst ↦value = 1;"), "TypeScript docs.");
    assert.equal(await readComment("python", 'def ↦run():\n    """Python docs."""'), "Python docs.");
  });

  it("keeps documentation isolated between different source texts", async () => {
    const first = "/** First docs. */\nconst ↦value = 1;";
    const second = "/** Second docs. */\nconst ↦value = 1;";
    assert.equal(await readComment("typescript", first), "First docs.");
    assert.equal(await readComment("typescript", second), "Second docs.");
    assert.equal(await readComment("typescript", first), "First docs.");
  });

  it("accepts changed source without explicit cache invalidation", async () => {
    await readComment("typescript", "/** First docs. */\nconst ↦value = 1;");
    assert.equal(await readComment("typescript", "/** New docs. */\nconst ↦value = 1;"), "New docs.");
  });

  it("can reread source after exceeding the tree cache capacity", async () => {
    for (let index = 0; index < 10; index++) {
      assert.equal(
        await readComment("typescript", `/** Document ${index}. */\nconst ↦value = ${index};`),
        `Document ${index}.`,
      );
    }
    assert.equal(await readComment("typescript", "/** Document 0. */\nconst ↦value = 0;"), "Document 0.");
  });
});
