import { access, readFile } from "node:fs/promises";

const REQUIRED_FILES = Object.freeze([
  "Dockerfile",
  "compose.yaml",
  "docker-compose.yml",
  ".env.example",
  ".repo-class.json",
  "package-lock.json",
  "requirements.lock.txt",
  "CHANGELOG.md",
  "README.md",
  "docs/RELEASE_READINESS.md",
  "backend/review-context-service.mjs",
  "backend/logging.mjs",
  "canva-app/package.json",
  "canva-app/package-lock.json",
  "canva-app/src/intents/design_editor/app.tsx",
  "canva-app/src/intents/design_editor/scenario-contract.ts",
  "canva-app/src/intents/design_editor/spatial-scenario-view.ts",
  "canva-app/src/intents/design_editor/spatial-preview.ts",
  "canva-app/src/intents/design_editor/placement-experiment.ts",
  "canva-app/src/intents/design_editor/placement-scenario.ts",
  ".github/workflows/verify-legacy.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/holoforge-canva.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/release.yml",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  "scripts/create-release-manifest.mjs",
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

  const [pkg, appPkg, changelog, ci, conventionalCi, appCi, codeql, release, readme, envExample, classification] = await Promise.all([
    json("package.json"),
    json("canva-app/package.json"),
    text("CHANGELOG.md"),
    text(".github/workflows/verify-legacy.yml"),
    text(".github/workflows/ci.yml"),
    text(".github/workflows/holoforge-canva.yml"),
    text(".github/workflows/codeql.yml"),
    text(".github/workflows/release.yml"),
    text("README.md"),
    text(".env.example"),
    json(".repo-class.json"),
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
  assert(classification.primaryClass === "application-tooling", "repository classification must remain application tooling");
  assert(classification.excludedClasses?.includes("infrastructure-as-code"), "repository classification must explicitly exclude infrastructure-as-code");
  for (const key of ["CANVA_APP_ID", "CANVA_APP_ORIGIN", "REVIEW_CONTEXT_SOURCE_URL", "PORT", "GITHUB_SHA", "RELEASE_TAG"]) {
    assert(new RegExp(`^${key}=`, "mu").test(envExample), `.env.example must document ${key}`);
  }
  assert(pkg.exports && typeof pkg.exports === "object", "root maintained exports are required");
  for (const [name, target] of Object.entries(pkg.exports)) {
    assert(typeof target === "string" && target.startsWith("./"), `invalid export target: ${name}`);
    await access(new URL(target, root));
  }

  assert(/^\d+\.\d+\.\d+$/u.test(appPkg.version), "Design Editor package version must be semantic");
  for (const name of ["typecheck", "test", "build"]) {
    assert(typeof appPkg.scripts?.[name] === "string", `Design Editor script missing: ${name}`);
  }

  assert(/## Unreleased/u.test(changelog), "changelog must contain current unreleased state");
  assert(
    changelog.includes(`Current root application candidate: \`${pkg.version}\``),
    "changelog candidate version must match root package.json",
  );
  assert(/trusted server-side review-context boundary/iu.test(changelog), "changelog must record trusted backend boundary");
  assert(/spatial scenario view/iu.test(changelog), "changelog must record spatial scenario work");

  assert(/npm ci --ignore-scripts/u.test(ci), "engineering CI must use locked Node installs");
  assert(/npm audit --audit-level=moderate/u.test(ci), "engineering CI must audit root dependencies");
  assert(/npm run verify:release/u.test(ci), "engineering CI must enforce release-readiness verifier");
  assert(/docker compose -f docker-compose\.yml config --quiet/u.test(ci), "engineering CI must validate canonical docker-compose.yml");
  assert(/docker compose up --build/u.test(ci), "engineering CI must execute the maintained Compose path");
  assert(/\/health/u.test(ci), "engineering CI must probe the trusted backend health endpoint");
  const backendSource = await text("backend/review-context-service.mjs");
  const loggingSource = await text("backend/logging.mjs");
  assert(/uptimeSeconds/u.test(backendSource) && /version/u.test(backendSource), "backend health payload must expose uptime and version");
  assert(/createJsonLogger/u.test(backendSource) && /timestamp/u.test(loggingSource) && /level/u.test(loggingSource), "backend must use a structured JSON logger");
  assert(/npm run typecheck/u.test(ci), "Design Editor CI must type-check");
  assert(/npm run build/u.test(ci), "Design Editor CI must build");
  assert(/npm test/u.test(appCi), "HoloForge app workflow must run tests");
  assert(
    /coverage xml -o coverage\.xml/u.test(ci) &&
      /NODE_V8_COVERAGE:\s*coverage\/v8/u.test(ci) &&
      /actions\/upload-artifact@v7/u.test(ci),
    "engineering CI must retain Python and maintained-runtime coverage evidence",
  );
  assert(/npm test/u.test(conventionalCi), "conventional CI must expose root tests");
  assert(/python -m pytest/u.test(conventionalCi), "conventional CI must expose Python tests");
  assert(/python -m ruff check/u.test(conventionalCi), "conventional CI must expose Python lint");
  assert(/python -m mypy/u.test(conventionalCi), "conventional CI must expose Python typecheck");
  assert(/npm run typecheck/u.test(conventionalCi) && /npm run build/u.test(conventionalCi), "conventional CI must expose Design Editor typecheck/build");
  assert(/pull_request:/u.test(codeql), "CodeQL must run on pull requests");
  assert(
    /javascript-typescript/u.test(codeql) && /python/u.test(codeql),
    "CodeQL must analyze JavaScript/TypeScript and Python",
  );
  assert(/workflow_dispatch:/u.test(release), "GitHub release workflow must remain manual-only");
  assert(/github\.ref == 'refs\/heads\/main'/u.test(release), "release workflow must require main");
  assert(/make verify-fresh/u.test(release), "release workflow must verify the full fresh application path");
  assert(/Requested tag must equal/u.test(release), "release workflow must bind the tag to package version");
  assert(/npm sbom --sbom-format=cyclonedx/u.test(release), "release workflow must generate root dependency evidence");
  assert(/canva-app-sbom\.cdx\.json/u.test(release), "release workflow must generate Design Editor dependency evidence");
  assert(/python -m pip list --format=json/u.test(release), "release workflow must snapshot Python dependencies");
  assert(/release-artifacts\.sha256/u.test(release), "release workflow must checksum attached evidence");
  assert(/release-manifest\.json/u.test(release), 'release workflow must attach an exact provenance manifest');
  assert(
    /RELEASE_TAG/u.test(release) && /GITHUB_SHA/u.test(release),
    'release manifest must bind requested tag and exact commit',
  );
  assert(
    /sha256sum --check release-artifacts\.sha256/u.test(release),
    'release workflow must verify its evidence checksums before publication',
  );
  assert(
    /actions\/upload-artifact@v7/u.test(release),
    'release workflow must retain the verified evidence bundle as a workflow artifact',
  );
  assert(/retention-days: 30/u.test(release), 'release evidence retention must remain explicit');

  assert(
    /node scripts\/create-release-manifest\.mjs/u.test(release),
    'release workflow must use the validated manifest generator',
  );
  assert(
    /node scripts\/create-release-manifest\.mjs/u.test(ci),
    'quality workflow must smoke-test release manifest generation',
  );
  assert(/gh release create/u.test(release), "release workflow must publish through GitHub Releases");
  assert(/explicit-user-Apply/iu.test(changelog), "explicit Apply authority boundary must remain documented");
  assert(
    /candidate is not published until the gated manual release workflow publishes it/iu.test(
      changelog,
    ),
    "changelog must distinguish the current candidate from hosted releases",
  );
  assert(/explicit-user-Apply/iu.test(changelog), "release notes must preserve explicit Apply authority");

  assert(/make verify-fresh/u.test(readme), "README must document full fresh-clone verification");

  process.stdout.write(
    `Canva/HoloForge release readiness verified: root v${pkg.version}, app v${appPkg.version}, trusted backend + spatial scenario + explicit Apply gates present\n`,
  );
}

await main();
