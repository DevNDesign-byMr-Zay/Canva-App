import { createHash } from "node:crypto";
import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptsDir, "..");
const outputRoot = resolve(root, process.argv[2] ?? ".artifacts/canva-apps");

const APPS = Object.freeze([
  {
    id: "holoforge",
    label: "HoloForge",
    sourceDir: join(root, "apps", "holoforge-canva"),
    forbiddenProduct: "DEPTHPOP",
  },
  {
    id: "depthpop",
    label: "DepthPop",
    sourceDir: join(root, "apps", "depthpop-canva"),
    forbiddenProduct: "HoloForge",
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
    if (entry.isDirectory()) files.push(...(await listFiles(path, base)));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
  }
  return files.sort();
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function startHere(label) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=./preview/index.html">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${label} Canva App Preview</title>
</head>
<body><p>Opening ${label} preview… <a href="./preview/index.html">Open preview</a>.</p></body>
</html>
`;
}

for (const app of APPS) {
  const buildDir = join(app.sourceDir, "dist");
  const previewDir = join(app.sourceDir, "preview");
  for (const required of [buildDir, previewDir, join(app.sourceDir, "canva-app.json")]) {
    if (!(await exists(required))) {
      throw new Error(`Missing ${app.label} package input: ${relative(root, required)}`);
    }
  }

  const out = join(outputRoot, app.id);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(buildDir, out, { recursive: true });
  await cp(join(app.sourceDir, "canva-app.json"), join(out, "canva-app.json"));
  await cp(join(app.sourceDir, "README.md"), join(out, "README.md"));
  await cp(previewDir, join(out, "preview"), { recursive: true });
  await writeFile(join(out, "START-HERE.html"), startHere(app.label), "utf8");
  await writeFile(
    join(out, "UPLOAD-TO-CANVA.txt"),
    `${app.label.toUpperCase()} — CANVA DEVELOPER PORTAL UPLOAD

This ZIP represents one Canva app only: ${app.label}.

1. Extract the ZIP.
2. Open START-HERE.html for a local visual preview.
3. In the separate ${app.label} app record in Canva Developer Portal, open:
   Inside Canva > Code upload > JavaScript bundle.
4. Upload app.js from the root of this package.

Do not upload the ZIP or the HTML preview as the Canva JavaScript bundle.
`,
    "utf8",
  );

  let files = await listFiles(out);
  for (const required of [
    "app.js",
    "canva-app.json",
    "README.md",
    "START-HERE.html",
    "UPLOAD-TO-CANVA.txt",
    "preview/index.html",
    "preview/styles.css",
    "preview/preview.js",
  ]) {
    if (!files.includes(required)) throw new Error(`${app.label} package missing ${required}`);
  }

  if (files.some((file) => file.startsWith("app/"))) {
    throw new Error(`${app.label} app.js must be at the package root`);
  }

  for (const file of files) {
    const info = await stat(join(out, file));
    if (info.size <= 0) throw new Error(`${app.label} package contains empty file: ${file}`);
  }

  const manifest = JSON.parse(await readFile(join(out, "canva-app.json"), "utf8"));
  if (manifest?.intent?.design_editor?.enrolled !== true) {
    throw new Error(`${app.label} must enroll the Canva Design Editor intent`);
  }

  const previewHtml = await readFile(join(out, "preview", "index.html"), "utf8");
  if (!previewHtml.includes(app.label)) {
    throw new Error(`${app.label} preview does not identify its own product`);
  }
  if (previewHtml.includes(app.forbiddenProduct)) {
    throw new Error(`${app.label} preview leaked the other Canva app: ${app.forbiddenProduct}`);
  }

  const appBundle = await readFile(join(out, "app.js"), "utf8");
  if (appBundle.length < 10000) throw new Error(`${app.label} app.js is implausibly small`);
  if (app.id === "holoforge" && /DEPTHPOP|DepthPop/u.test(appBundle)) {
    throw new Error("HoloForge production bundle contains DepthPop code");
  }
  if (app.id === "depthpop" && /HoloForge/u.test(appBundle)) {
    throw new Error("DepthPop production bundle contains HoloForge code");
  }

  files = await listFiles(out);
  const inventory = [];
  for (const file of files) {
    const path = join(out, file);
    const info = await stat(path);
    inventory.push({ path: file, bytes: info.size, sha256: await sha256(path) });
  }
  await writeFile(
    join(out, "PACKAGE_MANIFEST.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        app: app.id,
        product: app.label,
        canvaUpload: "app.js",
        preview: "START-HERE.html",
        files: inventory,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

process.stdout.write(
  `assembled independent Canva apps at ${relative(root, outputRoot)}: HoloForge + DepthPop\n`,
);
