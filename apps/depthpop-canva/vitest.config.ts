import { defineConfig } from "vitest/config";

// Include unexecuted UI and 3D modules, while retaining a stronger gate for
// deterministic animation interpolation.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 55,
        statements: 53,
        functions: 54,
        branches: 58,
        "src/intents/design_editor/animation/interpolation.ts": {
          lines: 70,
          statements: 70,
          functions: 70,
          branches: 60,
        },
      },
    },
  },
});
