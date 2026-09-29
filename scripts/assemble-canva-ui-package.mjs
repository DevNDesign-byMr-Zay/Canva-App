import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptsDir, "..");
const buildDir = join(root, "canva-app", "dist");
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

if (!(await exists(buildDir))) {
  throw new Error(
    "Canva build output is missing. Run `npm --prefix canva-app run build` before packaging the UI.",
  );
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(buildDir, join(outputDir, "app"), { recursive: true });
await cp(join(root, "canva-app", "canva-app.json"), join(outputDir, "canva-app.json"));
await cp(join(root, "canva-app", "README.md"), join(outputDir, "README.md"));

const packageNote = `CANVA UI DISTRIBUTION

This package contains only the maintained Canva application build for HoloForge and DepthPop.
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

const manifest = await readFile(join(outputDir, "canva-app.json"), "utf8");
if (!manifest.includes('"design_editor"') || !manifest.includes('"enrolled": true')) {
  throw new Error("Packaged Canva manifest does not expose the Design Editor intent.");
}

process.stdout.write(
  `clean Canva UI package assembled at ${relative(root, outputDir)} (${files.length} files; root=${basename(outputDir)})\n`,
);
