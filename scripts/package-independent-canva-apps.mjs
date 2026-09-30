import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptsDir, "..");
const outputRoot = resolve(root, process.argv[2] ?? ".artifacts/independent-canva-apps");

const APPS = Object.freeze([
  {
    id: "holoforge-canva",
    displayName: "HoloForge",
    includeBackend: false,
    includeReference: false,
  },
  {
    id: "depthpop-canva",
    displayName: "DepthPop",
    includeBackend: true,
    includeReference: true,
  },
]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path, base)));
    } else if (entry.isFile()) {
      files.push(relative(base, path).replaceAll("\\", "/"));
    }
  }
  return files;
}

async function assertNonEmptyFile(path, label) {
  const info = await stat(path);
  if (!info.isFile() || info.size <= 0) {
    throw new Error(`${label} is missing or empty: ${relative(root, path)}`);
  }
}

function startHereHtml(displayName) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=./preview/index.html" />
    <title>${displayName} Canva App Preview</title>
  </head>
  <body>
    <p>Opening ${displayName} UI preview… <a href="./preview/index.html">Open preview</a>.</p>
  </body>
</html>
`;
}

function uploadInstructions(displayName) {
  return `${displayName.toUpperCase()} — CANVA DEVELOPER PORTAL

This ZIP is a complete developer handoff package. It is NOT the file Canva parses as JavaScript.

CANVA INSTALL:
1. Open the dedicated ${displayName} app in Canva Developer Portal.
2. Go to Inside Canva > Code upload.
3. Choose JavaScript bundle.
4. Upload the root-level app.js from THIS package.

LOCAL UI REVIEW:
- Open START-HERE.html, or open preview/index.html directly.

DO NOT upload:
- this ZIP itself as JavaScript,
- START-HERE.html,
- preview/index.html,
- source files,
- backend files.

${displayName} is packaged as an independent Canva app with its own app.js and canva-app.json.
`;
}

function packageContents(app) {
  const backend = app.includeBackend
    ? "- backend/                 -> DepthPop authenticated processing service, tests, Dockerfile, requirements and env template\n"
    : "";
  const reference = app.includeReference
    ? "- reference/               -> exact Drive UI/router provenance used to rebuild DepthPop\n"
    : "";

  return `${app.displayName.toUpperCase()} — COMPLETE CANVA APP PACKAGE

ROOT
- app.js                   -> compiled Canva JavaScript bundle
- canva-app.json           -> Canva app manifest
- START-HERE.html          -> local browser entrypoint
- UPLOAD-TO-CANVA.txt      -> exact upload instructions
- README.md                -> app architecture and development notes
- package.json             -> app dependencies/scripts
- tsconfig.json            -> TypeScript configuration

UI
- preview/index.html       -> standalone browser preview
- src/                     -> maintained React/TypeScript/CSS UI source
${backend}${reference}
This package intentionally contains no node_modules, no secret .env file, and no combined HoloForge/DepthPop runtime switcher.
`;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const app of APPS) {
  const source = join(root, "apps", app.id);
  const destination = join(outputRoot, app.id);
  const buildBundle = join(source, "dist", "app.js");
  const manifestPath = join(source, "canva-app.json");
  const previewPath = join(source, "preview", "index.html");

  for (const [path, label] of [
    [buildBundle, `${app.displayName} compiled Canva bundle`],
    [manifestPath, `${app.displayName} Canva manifest`],
    [previewPath, `${app.displayName} HTML UI preview`],
  ]) {
    if (!(await exists(path))) {
      throw new Error(`${label} is missing. Build both independent apps before packaging.`);
    }
    await assertNonEmptyFile(path, label);
  }

  await mkdir(destination, { recursive: true });
  await cp(buildBundle, join(destination, "app.js"));
  await cp(manifestPath, join(destination, "canva-app.json"));
  await cp(join(source, "README.md"), join(destination, "README.md"));
  await cp(join(source, "package.json"), join(destination, "package.json"));
  await cp(join(source, "tsconfig.json"), join(destination, "tsconfig.json"));
  await cp(join(source, "src"), join(destination, "src"), { recursive: true });
  await cp(join(source, "preview"), join(destination, "preview"), { recursive: true });

  const envTemplate = join(source, ".env.template");
  if (await exists(envTemplate)) {
    await cp(envTemplate, join(destination, ".env.template"));
  }

  if (app.includeBackend) {
    await cp(join(source, "backend"), join(destination, "backend"), { recursive: true });
  }
  if (app.includeReference) {
    await cp(join(source, "reference"), join(destination, "reference"), { recursive: true });
  }

  await writeFile(join(destination, "START-HERE.html"), startHereHtml(app.displayName), "utf8");
  await writeFile(join(destination, "UPLOAD-TO-CANVA.txt"), uploadInstructions(app.displayName), "utf8");
  await writeFile(join(destination, "PACKAGE_CONTENTS.txt"), packageContents(app), "utf8");

  const manifest = JSON.parse(await readFile(join(destination, "canva-app.json"), "utf8"));
  if (manifest?.intent?.design_editor?.enrolled !== true) {
    throw new Error(`${app.displayName} manifest is not enrolled in the Canva Design Editor intent.`);
  }

  const preview = await readFile(join(destination, "preview", "index.html"), "utf8");
  if (!preview.includes(app.displayName.toUpperCase())) {
    throw new Error(`${app.displayName} preview does not visibly identify the correct app.`);
  }

  const files = await listFiles(destination);
  for (const file of files) {
    const filePath = join(destination, file);
    await assertNonEmptyFile(filePath, `${app.displayName} package member`);
    if (file.includes("node_modules/") || file === ".env") {
      throw new Error(`Forbidden package member: ${file}`);
    }
  }

  if (!files.includes("app.js") || !files.includes("START-HERE.html") || !files.includes("preview/index.html")) {
    throw new Error(`${app.displayName} package is missing its executable bundle or visible HTML UI.`);
  }

  if (app.includeBackend) {
    for (const required of [
      "backend/app.py",
      "backend/Dockerfile",
      "backend/requirements.txt",
      "backend/test_app.py",
      "backend/.env.example",
    ]) {
      if (!files.includes(required)) {
        throw new Error(`DepthPop package is missing required backend file: ${required}`);
      }
    }
  }

  process.stdout.write(
    `${app.displayName} package ready: ${relative(root, destination)} (${files.length} files)\n`,
  );
}
