import { defineConfig } from "vitest/config";

// Initial critical-module gate. Expand this to UI/3D modules after their
// deterministic tests meet the same threshold; do not claim full-app coverage.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/intents/design_editor/holographic/material-contract.ts",
        "src/intents/design_editor/holographic/capability-matrix.ts",
      ],
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
