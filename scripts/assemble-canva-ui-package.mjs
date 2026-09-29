import { createHash } from "node:crypto";
import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

function buildProductHtml(previewHtml, product, assetPrefix = "./") {
  const config = {
    holoforge: { title: "HoloForge", viewId: "holoforge-view", otherViewId: "depthpop-view" },
    depthpop: { title: "DepthPop", viewId: "depthpop-view", otherViewId: "holoforge-view" },
  }[product];

  if (!config) throw new Error(`Unknown Canva product: ${product}`);

  let html = previewHtml
    .replace('<html lang="en">', `<html lang="en" data-product-lock="${product}">`)
    .replace(/<title>[\s\S]*?<\/title>/u, `<title>${config.title} Canva App UI</title>`)
    .replace(/\s*<nav class="product-switcher"[\s\S]*?<\/nav>\s*/u, "\n");

  const otherView = new RegExp(
    `\\s*<section class="product-view(?: is-active)?" id="${config.otherViewId}">[\\s\\S]*?<\\/section>\\s*`,
    "u",
  );
  html = html.replace(otherView, "\n");

  if (product === "depthpop") {
    html = html.replace(
      '<section class="product-view" id="depthpop-view">',
      '<section class="product-view is-active" id="depthpop-view">',
    );
  }

  return html
    .replace('href="./styles.css"', `href="${assetPrefix}styles.css"`)
    .replaceAll('src="./assets/', `src="${assetPrefix}assets/`)
    .replace('src="./preview.js"', `src="${assetPrefix}preview.js"`);
}

function productUiDefinition(product) {
  if (product === "holoforge") {
    return {
      schemaVersion: 1,
      product: "HoloForge",
      surface: "Canva Design Editor sidebar",
      entrypoints: { production: "app.js", manifest: "app.json", html: "app.html" },
      workflow: ["CREATE", "SPATIAL", "VERIFY"],
      controls: [
        "creation type",
        "holographic material presets",
        "material tuning",
        "spatial preview",
        "verified explicit apply",
      ],
    };
  }

  return {
    schemaVersion: 1,
    product: "DepthPop",
    surface: "Canva Design Editor sidebar",
    entrypoints: { production: "app.js", manifest: "app.json", html: "app.html" },
    controls: [
      "Depth Strength (subject pop)",
      "Depth Blur (background softness)",
      "Depth Fidelity (depth-map accuracy)",
      "Render Quality: Fast / Balanced / Cinematic",
      "EXECUTE DEPTHPOP",
    ],
    execution: "fail-closed until authenticated Canva-compatible provider exists",
  };
}

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
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
// Keep app.js and generated companion files at the package root so the
// correct upload target is immediately obvious.
await cp(buildDir, outputDir, { recursive: true });

await cp(join(root, "canva-app", "canva-app.json"), join(outputDir, "canva-app.json"));
// app.json is a convenience alias for inspection/export tools that expect that
// conventional filename. canva-app.json remains the canonical Canva manifest.
await cp(join(root, "canva-app", "canva-app.json"), join(outputDir, "app.json"));
await cp(join(root, "canva-app", "README.md"), join(outputDir, "README.md"));
await cp(
  join(root, "docs", "DEPTHPOP_CANVA_PARITY.md"),
  join(outputDir, "DEPTHPOP_PARITY.md"),
);

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
2. Do NOT upload START-HERE.html, HOLOFORGE.html, DEPTHPOP.html, or preview/index.html to Canva.
3. In Canva Developer Portal > Inside Canva > Code upload, choose JavaScript bundle.
4. Upload the root-level file: app.js

To inspect the UI locally:
- START-HERE.html opens the combined HoloForge + DepthPop preview.
- HOLOFORGE.html opens directly to HoloForge.
- DEPTHPOP.html opens directly to DepthPop.
- app.json and canva-app.json contain the same complete Canva manifest.

The production Canva UI is bundled into app.js because Canva Apps run inside Canva's iframe.
The HTML preview is intentionally separate and does not call Canva APIs.
`;
await writeFile(join(outputDir, "UPLOAD-TO-CANVA.txt"), uploadNote, "utf8");

const packageNote = `CANVA UI DISTRIBUTION

This package contains the maintained Canva application build for HoloForge and DepthPop.

ROOT FILES
- app.js                 -> upload THIS file to Canva Developer Portal
- app.json               -> complete manifest alias for inspection/export tooling
- canva-app.json         -> canonical Canva app manifest
- messages_en.json       -> generated translation catalog
- START-HERE.html        -> combined local visual UI preview
- HOLOFORGE.html         -> local HTML entrypoint focused on HoloForge
- DEPTHPOP.html          -> local HTML entrypoint focused on DepthPop
- UPLOAD-TO-CANVA.txt    -> upload instructions
- PACKAGE_MANIFEST.json  -> file inventory, byte counts and SHA-256 hashes
- DEPTHPOP_PARITY.md      -> Drive v115 control + Canva sidebar parity contract

PREVIEW
- preview/index.html     -> full local browser preview for HoloForge + DepthPop
- preview/styles.css
- preview/preview.js
- preview/assets/*.svg

SEPARATE COMPLETE APP PACKAGES
- products/holoforge/    -> HoloForge-locked app.js + app.json + full HTML UI + assets
- products/depthpop/     -> DepthPop-locked app.js + app.json + full HTML UI + assets
- each product package includes app.html, index.html, ui.json and its own PACKAGE_MANIFEST.json

Historical AETHER/ROARY application material, archive reconstruction payloads, provenance corpora, SBOM evidence, and internal verifier code are intentionally excluded.
`;
await writeFile(join(outputDir, "PACKAGE_CONTENTS.txt"), packageNote, "utf8");

let files = await listFiles(outputDir);
if (files.length === 0) throw new Error("Canva UI package unexpectedly contains no files.");

for (const file of files) {
  const lower = file.toLowerCase();
  for (const forbidden of FORBIDDEN_PATH_PARTS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Forbidden historical/internal path leaked into Canva UI package: ${file}`);
    }
  }

  const info = await stat(join(outputDir, file));
  if (info.size <= 0) {
    throw new Error(`Canva UI package contains an empty file: ${file}`);
  }
}

for (const required of [
  "app.js",
  "app.json",
  "canva-app.json",
  "messages_en.json",
  "START-HERE.html",
  "HOLOFORGE.html",
  "DEPTHPOP.html",
  "UPLOAD-TO-CANVA.txt",
  "DEPTHPOP_PARITY.md",
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

const [manifestText, appManifestText, messagesText, previewHtml, appJs] = await Promise.all([
  readFile(join(outputDir, "canva-app.json"), "utf8"),
  readFile(join(outputDir, "app.json"), "utf8"),
  readFile(join(outputDir, "messages_en.json"), "utf8"),
  readFile(join(outputDir, "preview", "index.html"), "utf8"),
  readFile(join(outputDir, "app.js"), "utf8"),
]);

const manifest = JSON.parse(manifestText);
const appManifest = JSON.parse(appManifestText);
JSON.parse(messagesText);

if (JSON.stringify(manifest) !== JSON.stringify(appManifest)) {
  throw new Error("app.json must remain byte-equivalent in meaning to canva-app.json.");
}
if (!manifest.intent?.design_editor?.enrolled) {
  throw new Error("Packaged Canva manifest does not expose the Design Editor intent.");
}
if (appJs.trim().length < 10_000) {
  throw new Error("Packaged app.js is unexpectedly small and may be incomplete.");
}
if (!previewHtml.includes("HoloForge") || !previewHtml.includes("DepthPop")) {
  throw new Error("Local preview must visibly include both HoloForge and DepthPop.");
}
for (const requiredDepthPopCopy of [
  "Depth Strength (subject pop)",
  "Depth Blur (background softness)",
  "Depth Fidelity (depth-map accuracy)",
  "Render Quality",
  "Cinematic",
  "EXECUTE DEPTHPOP",
]) {
  if (!previewHtml.includes(requiredDepthPopCopy)) {
    throw new Error(`DepthPop preview drifted from Drive v115: missing ${requiredDepthPopCopy}`);
  }
}
const previewCss = await readFile(join(outputDir, "preview", "styles.css"), "utf8");
if (!/\.canva-sidebar\s*\{[^}]*width:\s*350px/su.test(previewCss)) {
  throw new Error("Preview must use the 350px Canva desktop sidebar envelope.");
}
if (!/\.sidebar-inner\s*\{[^}]*padding:\s*16px/su.test(previewCss)) {
  throw new Error("Preview must retain the 16px Canva iframe inset.");
}
if (/AETHER|R\.O\.A\.R\.Y Studio/u.test(previewHtml)) {
  throw new Error("Legacy AETHER/ROARY UI text leaked into the local preview.");
}

// Root HTML files are full product UIs, not redirect stubs.
const holoforgeHtml = buildProductHtml(previewHtml, "holoforge", "./preview/");
const depthpopHtml = buildProductHtml(previewHtml, "depthpop", "./preview/");
await writeFile(join(outputDir, "HOLOFORGE.html"), holoforgeHtml, "utf8");
await writeFile(join(outputDir, "DEPTHPOP.html"), depthpopHtml, "utf8");
if (holoforgeHtml.length < 4_000 || depthpopHtml.length < 3_000) {
  throw new Error("Product HTML entrypoints are unexpectedly small or incomplete.");
}

const productSpecs = Object.freeze([
  { id: "holoforge", title: "HoloForge", htmlName: "HOLOFORGE.html" },
  { id: "depthpop", title: "DepthPop", htmlName: "DEPTHPOP.html" },
]);

for (const product of productSpecs) {
  const productDir = join(outputDir, "products", product.id);
  await mkdir(productDir, { recursive: true });

  // Copy the complete Canva build so emitted assets and translation files stay beside app.js.
  await cp(buildDir, productDir, { recursive: true });

  const lockedBundle =
    `globalThis.__MRZAY_CANVA_PRODUCT__ = "${product.id}";\n${appJs}`;
  await writeFile(join(productDir, "app.js"), lockedBundle, "utf8");

  await cp(join(outputDir, "canva-app.json"), join(productDir, "canva-app.json"));
  await cp(join(outputDir, "app.json"), join(productDir, "app.json"));

  const standaloneHtml = buildProductHtml(previewHtml, product.id, "./");
  await writeFile(join(productDir, "app.html"), standaloneHtml, "utf8");
  await writeFile(join(productDir, "index.html"), standaloneHtml, "utf8");
  await writeFile(join(productDir, product.htmlName), standaloneHtml, "utf8");
  await writeFile(
    join(productDir, "ui.json"),
    JSON.stringify(productUiDefinition(product.id), null, 2) + "\n",
    "utf8",
  );

  await cp(join(outputDir, "preview", "styles.css"), join(productDir, "styles.css"));
  await cp(join(outputDir, "preview", "preview.js"), join(productDir, "preview.js"));
  await mkdir(join(productDir, "assets"), { recursive: true });
  await cp(
    join(outputDir, "preview", "assets", "holoforge-logo.svg"),
    join(productDir, "assets", "holoforge-logo.svg"),
  );
  await cp(
    join(outputDir, "preview", "assets", "depthpop-logo.svg"),
    join(productDir, "assets", "depthpop-logo.svg"),
  );

  const productReadme = `# ${product.title} Canva App Package

This folder is a complete, product-locked Canva distribution.

- Upload \`app.js\` in Canva Developer Portal as the JavaScript bundle.
- \`app.json\` and \`canva-app.json\` are complete, valid Canva manifests.
- \`app.html\`, \`index.html\`, and \`${product.htmlName}\` contain the full standalone ${product.title} UI for visual inspection.
- \`ui.json\` is a structured inventory of the visible UI surface.
- Generated companion files and static assets are included beside the bundle.
- \`PACKAGE_MANIFEST.json\` records byte sizes and SHA-256 hashes.

The JavaScript bundle is explicitly locked to ${product.title}; it does not show the cross-product switcher.
`;
  await writeFile(join(productDir, "README.md"), productReadme, "utf8");

  const productUploadNote = `CANVA DEVELOPER PORTAL UPLOAD — ${product.title}

Upload app.js as the JavaScript bundle.
Do not upload the ZIP, JSON, or HTML files as JavaScript.
Open app.html or index.html locally to inspect the complete ${product.title} UI.
`;
  await writeFile(join(productDir, "UPLOAD-TO-CANVA.txt"), productUploadNote, "utf8");

  const productFilesBeforeManifest = await listFiles(productDir);
  for (const required of [
    "app.js",
    "app.json",
    "canva-app.json",
    "messages_en.json",
    "app.html",
    "index.html",
    product.htmlName,
    "ui.json",
    "README.md",
    "UPLOAD-TO-CANVA.txt",
    "styles.css",
    "preview.js",
    "assets/holoforge-logo.svg",
    "assets/depthpop-logo.svg",
  ]) {
    if (!productFilesBeforeManifest.includes(required)) {
      throw new Error(`${product.title} package is missing required file: ${required}`);
    }
  }

  for (const file of productFilesBeforeManifest) {
    const info = await stat(join(productDir, file));
    if (info.size <= 0) {
      throw new Error(`${product.title} package contains an empty file: ${file}`);
    }
  }

  JSON.parse(await readFile(join(productDir, "app.json"), "utf8"));
  JSON.parse(await readFile(join(productDir, "canva-app.json"), "utf8"));
  JSON.parse(await readFile(join(productDir, "messages_en.json"), "utf8"));
  JSON.parse(await readFile(join(productDir, "ui.json"), "utf8"));

  const productBundleText = await readFile(join(productDir, "app.js"), "utf8");
  if (!productBundleText.startsWith(`globalThis.__MRZAY_CANVA_PRODUCT__ = "${product.id}";`)) {
    throw new Error(`${product.title} bundle is not product-locked.`);
  }
  if (productBundleText.trim().length < 10_000) {
    throw new Error(`${product.title} app.js is unexpectedly small or incomplete.`);
  }

  const productInventory = [];
  for (const file of productFilesBeforeManifest) {
    const filePath = join(productDir, file);
    const info = await stat(filePath);
    productInventory.push({
      path: file,
      bytes: info.size,
      sha256: await sha256(filePath),
    });
  }

  await writeFile(
    join(productDir, "PACKAGE_MANIFEST.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        package: `${product.title} Canva App`,
        product: product.id,
        productLocked: true,
        entrypoints: {
          canvaBundle: "app.js",
          canvaManifest: "canva-app.json",
          manifestAlias: "app.json",
          html: "app.html",
          htmlIndex: "index.html",
          uiDefinition: "ui.json",
        },
        files: productInventory,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

files = await listFiles(outputDir);
for (const file of files) {
  const lower = file.toLowerCase();
  for (const forbidden of FORBIDDEN_PATH_PARTS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Forbidden historical/internal path leaked into Canva UI package: ${file}`);
    }
  }
  const info = await stat(join(outputDir, file));
  if (info.size <= 0) {
    throw new Error(`Canva UI package contains an empty file after product packaging: ${file}`);
  }
}

const inventory = [];
for (const file of files) {
  const path = join(outputDir, file);
  const info = await stat(path);
  inventory.push({
    path: file,
    bytes: info.size,
    sha256: await sha256(path),
  });
}
await writeFile(
  join(outputDir, "PACKAGE_MANIFEST.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      package: "HoloForge + DepthPop Canva UI",
      entrypoints: {
        canvaBundle: "app.js",
        canvaManifest: "canva-app.json",
        manifestAlias: "app.json",
        combinedHtmlPreview: "START-HERE.html",
        holoforgeHtmlPreview: "HOLOFORGE.html",
        depthpopHtmlPreview: "DEPTHPOP.html",
      },
      files: inventory,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

files = await listFiles(outputDir);
if (!files.includes("PACKAGE_MANIFEST.json")) {
  throw new Error("PACKAGE_MANIFEST.json was not written.");
}
const manifestInfo = await stat(join(outputDir, "PACKAGE_MANIFEST.json"));
if (manifestInfo.size <= 0) {
  throw new Error("PACKAGE_MANIFEST.json is empty.");
}

process.stdout.write(
  `complete Canva UI package assembled at ${relative(root, outputDir)} (${files.length} non-empty files; root=${basename(outputDir)})\n`,
);
