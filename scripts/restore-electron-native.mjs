/**
 * After Vitest, `better-sqlite3` is linked for system Node (`npm rebuild better-sqlite3`).
 * Electron needs the addon compiled for its Node ABI — restore unless CI (no Electron there).
 */
import { spawnSync } from "node:child_process";

if (process.env.CI === "true") {
  process.exit(0);
}

const result = spawnSync("npm", ["run", "rebuild:electron"], {
  stdio: "inherit",
  shell: true
});
process.exit(result.status ?? 1);
