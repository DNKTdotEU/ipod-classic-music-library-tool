import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["electron/**/*.ts", "src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/types.ts", "**/global.d.ts"]
    }
  }
});
