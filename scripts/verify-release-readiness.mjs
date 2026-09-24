import { access, readFile } from "node:fs/promises";

const REQUIRED_FILES = Object.freeze([
  "Dockerfile",
  "package-lock.json",
  "requirements.lock.txt",
  "CHANGELOG.md",
  "README.md",
  "backend/review-context-service.mjs",
  "canva-app/package.json",
  "canva-app/package-lock.json",
  "canva-app/src/intents/design_editor/app.tsx",
  "canva-app/src/intents/design_editor/scenario-contract.ts",
  "canva-app/src/intents/design_editor/spatial-scenario-view.ts",
  "canva-app/src/intents/design_editor/spatial-preview.ts",
  "canva-app/src/intents/design_editor/placement-experiment.ts",
  "canva-app/src/intents/design_editor/placement-scenario.ts",
  ".github/workflows/verify-legacy.yml",
  ".github/workflows/holoforge-canva.yml",
  ".github/workflows/codeql.yml",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function json(path) {
  return JSON.parse(await text(path));
}

async function main() {
  const root = new URL("../", import.meta.url);
  await Promise.all(REQUIRED_FILES.map((path) => access(new URL(path, root))));

  const [pkg, appPkg, changelog, ci, appCi, codeql, readme] = await Promise.all([
    json("package.json"),
    json("canva-app/package.json"),
    text("CHANGELOG.md"),
    text(".github/workflows/verify-legacy.yml"),
    text(".github/workflows/holoforge-canva.yml"),
    text(".github/workflows/codeql.yml"),
    text("README.md"),
  ]);

  assert(/^\d+\.\d+\.\d+$/u.test(pkg.version), "root package version must be semantic");
  assert(pkg.private === true, "root package must remain private");
  assert(pkg.type === "module", "root package must remain ESM");
  assert(
    typeof pkg.engines?.node === "string" && pkg.engines.node.includes("22"),
    "root Node 22+ contract is required",
  );
  assert(typeof pkg.scripts?.["app:verify"] === "string", "root app:verify script is required");
  assert(typeof pkg.scripts?.["verify:release"] === "string", "root verify:release script is required");

  assert(/^\d+\.\d+\.\d+$/u.test(appPkg.version), "Design Editor package version must be semantic");
  for (const name of ["typecheck", "test", "build"]) {
    assert(typeof appPkg.scripts?.[name] === "string", `Design Editor script missing: ${name}`);
  }

  assert(/## Unreleased/u.test(changelog), "changelog must contain current unreleased state");
  assert(/trusted server-side review-context boundary/iu.test(changelog), "changelog must record trusted backend boundary");
  assert(/spatial scenario view/iu.test(changelog), "changelog must record spatial scenario work");

  assert(/npm ci --ignore-scripts/u.test(ci), "engineering CI must use locked Node installs");
  assert(/npm audit --audit-level=moderate/u.test(ci), "engineering CI must audit root dependencies");
  assert(/npm run verify:release/u.test(ci), "engineering CI must enforce release-readiness verifier");
  assert(/npm run typecheck/u.test(ci), "Design Editor CI must type-check");
  assert(/npm run build/u.test(ci), "Design Editor CI must build");
  assert(/npm test/u.test(appCi), "HoloForge app workflow must run tests");
  assert(/pull_request:/u.test(codeql), "CodeQL must run on pull requests");
  assert(
    /javascript-typescript/u.test(codeql) && /python/u.test(codeql),
    "CodeQL must analyze JavaScript/TypeScript and Python",
  );
  assert(/explicit-user-Apply/iu.test(changelog), "explicit Apply authority boundary must remain documented");
  assert(/No hosted release is claimed/iu.test(changelog), "changelog must not fabricate a hosted release");
  assert(/make verify-fresh/u.test(readme), "README must document full fresh-clone verification");

  process.stdout.write(
    `Canva/HoloForge release readiness verified: root v${pkg.version}, app v${appPkg.version}, trusted backend + spatial scenario + explicit Apply gates present\n`,
  );
}

await main();
