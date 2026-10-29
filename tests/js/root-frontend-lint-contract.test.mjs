import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("root lint enforces both standalone ESLint installations without floating installs", () => {
  assert.equal(root.scripts.lint, "npm run verify:syntax && npm run lint:ts");
  assert.equal(root.scripts["lint:ts"], "npm --prefix apps/holoforge-canva run lint -- --max-warnings=0 && npm --prefix apps/depthpop-canva run lint -- --max-warnings=0");
  assert.equal(root.scripts["format:check:ts"], "npm --prefix apps/holoforge-canva run format:check && npm --prefix apps/depthpop-canva run format:check");
});
