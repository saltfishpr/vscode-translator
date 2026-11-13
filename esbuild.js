const esbuild = require("esbuild");

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
  const shared = {
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  };
  const contexts = await Promise.all([
    esbuild.context({
      ...shared,
      entryPoints: ["src/extension.ts"],
      format: "cjs",
      platform: "node",
      outfile: "dist/extension.js",
      external: ["vscode"],
    }),
    esbuild.context({
      ...shared,
      entryPoints: ["src/webview/index.tsx"],
      format: "iife",
      platform: "browser",
      target: "es2022",
      outfile: "dist/webview/index.js",
      define: { "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
    }),
  ]);
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    try {
      await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.dispose()));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
