import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: { statements: 85, branches: 80, functions: 90, lines: 90 },
      reporter: ["text", "json-summary", "lcov"],
    },
  },
});
