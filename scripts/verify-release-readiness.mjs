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
  ".github/workflows/holoforge-canva.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/release.yml",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  "scripts/create-release-manifest.mjs",
]);

function   assert(/explicit-user-Apply/iu.test(changelog), "release notes must preserve explicit Apply authority");

  assert(/make verify-fresh/u.test(readme), "README must document full fresh-clone verification");

  process.stdout.write(
    `Canva/HoloForge release readiness verified: root v${pkg.version}, app v${appPkg.version}, trusted backend + spatial scenario + explicit Apply gates present\n`,
  );
}

await main();
