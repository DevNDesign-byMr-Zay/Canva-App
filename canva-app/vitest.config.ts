import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*"],
      // Canva/React composition entrypoints are verified by typecheck + production build.
      // The blocking unit-coverage gate targets the deterministic Design Editor core.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/index.tsx",
        "src/intents/design_editor/index.tsx",
        "src/intents/design_editor/app.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
