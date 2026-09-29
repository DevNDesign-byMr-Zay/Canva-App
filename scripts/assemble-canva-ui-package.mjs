import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptsDir, "..");
const buildDir = join(root, "canva-app", "dist");
const previewDir = join(root, "canva-app", "preview");
const assetsDir = join(root, "canva-app", "src", "assets");
const outputDir = resolve(root, process.argv[2] ?? ".artifacts/canva-ui");

const FORBIDDEN_PATH_PARTS = Object.freeze([
  "app/authenticated-v115",
  "legacy-html",
  "provenance",
  "archive_verifier",
  "runtime/",
  "release-manifest.json",
  "sbom.cdx.json",
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
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
  }
  return files;
}

for (const required of [buildDir, previewDir]) {
  if (!(await exists(required))) {
    throw new Error(
      `Required Canva package input is missing: ${relative(root, required)}. Run the Canva build before packaging.`,
    );
  }
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

// Canva's Developer Portal expects the production bundle itself, not the ZIP.
// Keep app.js and its generated companion files at the package root so the
// correct upload target is immediately obvious.
await cp(buildDir, outputDir, { recursive: true });

await cp(join(root, "canva-app", "canva-app.json"), join(outputDir, "canva-app.json"));
await cp(join(root, "canva-app", "README.md"), join(outputDir, "README.md"));

await cp(previewDir, join(outputDir, "preview"), { recursive: true });
await mkdir(join(outputDir, "preview", "assets"), { recursive: true });
await cp(
  join(assetsDir, "holoforge-logo.svg"),
  join(outputDir, "preview", "assets", "holoforge-logo.svg"),
);
await cp(
  join(assetsDir, "depthpop-logo.svg"),
  join(outputDir, "preview", "assets", "depthpop-logo.svg"),
);

const startHere = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./preview/index.html" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HoloForge + DepthPop Preview</title>
  </head>
  <body>
    <p>Opening the local UI preview… <a href="./preview/index.html">Open preview</a>.</p>
  </body>
</html>
`;
await writeFile(join(outputDir, "START-HERE.html"), startHere, "utf8");

const uploadNote = `CANVA DEVELOPER PORTAL UPLOAD

1. Do NOT upload this ZIP as the JavaScript bundle.
2. Do NOT upload START-HERE.html or preview/index.html to Canva.
3. In Canva Developer Portal > Inside Canva > Code upload, choose JavaScript bundle.
4. Upload the root-level file: app.js

To inspect the UI locally, open START-HERE.html or preview/index.html in a browser.

The production Canva UI is bundled into app.js because Canva Apps run inside Canva's iframe.
The HTML preview is intentionally separate and does not call Canva APIs.
`;
await writeFile(join(outputDir, "UPLOAD-TO-CANVA.txt"), uploadNote, "utf8");

const packageNote = `CANVA UI DISTRIBUTION

This package contains the maintained Canva application build for HoloForge and DepthPop.

ROOT FILES
- app.js                 -> upload THIS file to Canva Developer Portal
- messages_en.json       -> generated translation catalog
- canva-app.json         -> app manifest
- START-HERE.html        -> open locally for visual UI preview
- UPLOAD-TO-CANVA.txt    -> upload instructions

PREVIEW
- preview/index.html     -> local browser preview for HoloForge + DepthPop
- preview/styles.css
- preview/preview.js
- preview/assets/*.svg

Historical AETHER/ROARY application material, archive reconstruction payloads, provenance corpora, SBOM evidence, and internal verifier code are intentionally excluded.
`;
await writeFile(join(outputDir, "PACKAGE_CONTENTS.txt"), packageNote, "utf8");

const files = await listFiles(outputDir);
if (files.length === 0) throw new Error("Canva UI package unexpectedly contains no files.");

for (const file of files) {
  const lower = file.toLowerCase();
  for (const forbidden of FORBIDDEN_PATH_PARTS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Forbidden historical/internal path leaked into Canva UI package: ${file}`);
    }
  }
}

for (const required of [
  "app.js",
  "canva-app.json",
  "START-HERE.html",
  "UPLOAD-TO-CANVA.txt",
  "preview/index.html",
  "preview/styles.css",
  "preview/preview.js",
  "preview/assets/holoforge-logo.svg",
  "preview/assets/depthpop-logo.svg",
]) {
  if (!files.includes(required)) {
    throw new Error(`Required Canva UI package member is missing: ${required}`);
  }
}

if (files.some((file) => file.startsWith("app/"))) {
  throw new Error("The Canva bundle must not be hidden under an app/ subdirectory.");
}

const manifest = await readFile(join(outputDir, "canva-app.json"), "utf8");
if (!manifest.includes('"design_editor"') || !manifest.includes('"enrolled": true')) {
  throw new Error("Packaged Canva manifest does not expose the Design Editor intent.");
}

const previewHtml = await readFile(join(outputDir, "preview", "index.html"), "utf8");
if (!previewHtml.includes("HoloForge") || !previewHtml.includes("DepthPop")) {
  throw new Error("Local preview must visibly include both HoloForge and DepthPop.");
}
if (/AETHER|R\.O\.A\.R\.Y Studio/u.test(previewHtml)) {
  throw new Error("Legacy AETHER/ROARY UI text leaked into the local preview.");
}

process.stdout.write(
  `clean Canva UI package assembled at ${relative(root, outputDir)} (${files.length} files; root=${basename(outputDir)})\n`,
);
