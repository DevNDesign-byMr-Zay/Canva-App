// Uses each application's committed ESLint installation; never downloads a tool.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const app of ["holoforge-canva", "depthpop-canva"]) {
  const cwd = fileURLToPath(new URL("../apps/" + app + "/", import.meta.url));
  const eslint = fileURLToPath(new URL("../apps/" + app + "/node_modules/eslint/bin/eslint.js", import.meta.url));
  const run = (input) => spawnSync(process.execPath, [eslint, "--stdin", "--stdin-filename", "src/lint-probe.ts", "--format", "json", "--max-warnings=0"], { cwd, input, encoding: "utf8", timeout: 30000 });
  const valid = run("export const lintProbe: number = 1;\n");
  assert.equal(valid.status, 0, app + ": valid TypeScript must pass: " + valid.stderr);
  const invalid = run("const unusedLintProbe: number = 1;\n");
  assert.equal(invalid.status, 1, app + ": invalid TypeScript must fail lint, not configuration: " + invalid.stderr);
  const reports = JSON.parse(invalid.stdout);
  assert.ok(reports.some((report) => report.messages.some((message) => message.ruleId === "@typescript-eslint/no-unused-vars" && message.severity === 2)), app + ": expected real unused-variable diagnostic");
  console.log(app + ": valid TypeScript passed; injected unused variable rejected with exit 1 and error severity");
}
