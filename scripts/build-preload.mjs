import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(root, "dist-electron", "preload.cjs");
const staleEsm = path.join(root, "dist-electron", "preload.js");

const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: [path.join(root, "electron", "preload.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile,
  logLevel: "info"
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
    try {
      fs.unlinkSync(staleEsm);
    } catch {
      /* tsc may not emit preload.js if excluded later */
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
