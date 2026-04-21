import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { build, context } from "esbuild";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = resolve(rootDir, "src");
const outFile = resolve(rootDir, "dist", "assets", "content.js");
const watch = process.argv.includes("--watch");

const aliasPlugin = {
  name: "alias-plugin",
  setup(buildContext) {
    buildContext.onResolve({ filter: /^@\// }, (args) => {
      const isInlineCss = args.path.endsWith(".css?inline");
      const requestedPath = isInlineCss
        ? args.path.slice(2).replace("?inline", "")
        : args.path.slice(2);
      const basePath = resolve(srcDir, requestedPath);
      const candidates = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.css`,
        resolve(basePath, "index.ts"),
        resolve(basePath, "index.tsx"),
        resolve(basePath, "index.js"),
      ];

      const match = candidates.find((candidate) => existsSync(candidate));
      const resolvedPath = match ?? basePath;

      if (isInlineCss) {
        return {
          path: resolvedPath,
          namespace: "css-inline",
        };
      }

      return {
        path: resolvedPath,
      };
    });
  },
};

const cssInlinePlugin = {
  name: "css-inline-plugin",
  setup(buildContext) {
    buildContext.onResolve({ filter: /\.css\?inline$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace("?inline", "")),
      namespace: "css-inline",
    }));

    buildContext.onLoad({ filter: /\.css$/, namespace: "css-inline" }, async (args) => {
      const { readFile } = await import("node:fs/promises");
      const css = await readFile(args.path, "utf8");
      return {
        contents: `export default ${JSON.stringify(css)};`,
        loader: "js",
      };
    });
  },
};

await mkdir(dirname(outFile), { recursive: true });

const common = {
  absWorkingDir: rootDir,
  entryPoints: [resolve(rootDir, "src", "content", "index.ts")],
  outfile: outFile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: true,
  tsconfig: resolve(rootDir, "tsconfig.json"),
  plugins: [aliasPlugin, cssInlinePlugin],
};

if (watch) {
  const watchContext = await context({
    ...common,
    logLevel: "info",
  });
  await watchContext.watch();
} else {
  await build({
    ...common,
    write: true,
    logLevel: "info",
  });
}
