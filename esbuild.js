const esbuild = require("esbuild");
const fs = require("node:fs/promises");
const path = require("node:path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const parserSource = path.dirname(require.resolve("@vscode/tree-sitter-wasm"));
  const parserTarget = path.join(__dirname, "dist", "parsers");
  await fs.mkdir(parserTarget, { recursive: true });
  await Promise.all(
    [
      "tree-sitter.wasm",
      "tree-sitter-go.wasm",
      "tree-sitter-typescript.wasm",
      "tree-sitter-tsx.wasm",
      "tree-sitter-javascript.wasm",
      "tree-sitter-python.wasm",
      "tree-sitter-java.wasm",
      "tree-sitter-cpp.wasm",
      "tree-sitter-c-sharp.wasm",
      "tree-sitter-rust.wasm",
      "tree-sitter-php.wasm",
      "tree-sitter-ruby.wasm",
    ].map((file) => fs.copyFile(path.join(parserSource, file), path.join(parserTarget, file))),
  );
  await fs.copyFile(path.join(parserSource, "..", "LICENSE"), path.join(parserTarget, "LICENSE"));
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "silent",
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
