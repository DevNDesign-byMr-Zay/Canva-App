import { defineConfig } from "vitest/config";

// Initial critical-module gate. The coverage surface is deliberately narrow;
// extend include as new component tests land rather than claiming full-app coverage.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/intents/design_editor/animation/interpolation.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
