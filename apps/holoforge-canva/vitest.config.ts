import { defineConfig } from "vitest/config";

// Include unexecuted UI and 3D modules, while retaining stronger gates for
// deterministic material and Canva capability contracts.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 41,
        statements: 40,
        functions: 35,
        branches: 44,
        "src/intents/design_editor/holographic/material-contract.ts": {
          lines: 70,
          statements: 70,
          functions: 70,
          branches: 60,
        },
        "src/intents/design_editor/holographic/capability-matrix.ts": {
          lines: 70,
          statements: 70,
          functions: 70,
          branches: 60,
        },
      },
    },
  },
});
