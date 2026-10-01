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
    packageName: "holoforge-canva-app",
    includeBackend: true,
    includeReference: false,
  },
  {
    id: "depthpop-canva",
    displayName: "DepthPop",
    packageName: "depthpop-canva-app",
    includeBackend: true,
    includeReference: false,
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
    ? app.id === "holoforge-canva"
      ? "- backend/                 -> HoloForge authenticated render/export service, Blender worker, tests, Dockerfile, requirements and env template\n"
      : "- backend/                 -> DepthPop authenticated processing service, tests, Dockerfile, requirements and env template\n"
    : "";
  const reference = app.includeReference
    ? "- reference/               -> exact Drive UI/router provenance used to rebuild DepthPop\n"
    : "";
  const webgl = app.id === "holoforge-canva"
    ? "- WebGL spatial studio     -> real Three.js/R3F scene model, camera, environment and timeline\n"
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
- preview/index.html       -> standalone browser preview with local test-file picker
- src/                     -> maintained React/TypeScript/CSS UI source
- src/assets/              -> packaged HoloForge or DepthPop logo asset
- image source workflow    -> production app can choose/drop PNG/JPEG/WebP and bind Canva raster sources
${webgl}${backend}
This package intentionally contains no node_modules, no secret .env file, no historical ROARY/ÆTHER shell, no Drive provenance HTML/router source, and no combined HoloForge/DepthPop runtime switcher.

Historical Drive sources remain in the GitHub repository for provenance only and are deliberately excluded from this user-facing Canva package.
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
  const logoPath = join(source, "src", "assets", app.id === "holoforge-canva" ? "holoforge-logo.svg" : "depthpop-logo.svg");
  const uploadSourcePath = join(source, "src", "intents", "design_editor", "local-image-upload.tsx");
  const uploadTestPath = join(source, "src", "intents", "design_editor", "local-image-upload.test.tsx");

  for (const [path, label] of [
    [buildBundle, `${app.displayName} compiled Canva bundle`],
    [manifestPath, `${app.displayName} Canva manifest`],
    [previewPath, `${app.displayName} HTML UI preview`],
    [logoPath, `${app.displayName} logo asset`],
    [uploadSourcePath, `${app.displayName} Canva upload implementation`],
    [uploadTestPath, `${app.displayName} Canva upload contract test`],
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

  if (app.id === "holoforge-canva") {
    const holoApp = await readFile(join(destination, "src", "intents", "design_editor", "app.tsx"), "utf8");
    for (const marker of [
      "useCanvaImageSelection",
      "canvaDerivedImageAdapter",
      'sourceLabel="HOLOGRAM SOURCE"',
      'insertIntoDesign={false}',
      "sourceImageRef={activeSourceRef}",
    ]) {
      if (!holoApp.includes(marker)) {
        throw new Error(`HoloForge packaged runtime is missing functional source/forge marker: ${marker}`);
      }
    }

    const webglViewport = await readFile(
      join(destination, "src", "intents", "design_editor", "viewport", "HoloViewport.tsx"),
      "utf8",
    );
    for (const marker of ["<Canvas", "<OrbitControls", "<HoloScene", "<ObjectInspector", "<AnimationPanel", "<ExportPanel", "requestAnimationFrame", "WEBGL LIVE"]) {
      if (!webglViewport.includes(marker)) {
        throw new Error(`HoloForge WebGL studio missing packaged marker: ${marker}`);
      }
    }

    const sceneView = await readFile(
      join(destination, "src", "intents", "design_editor", "viewport", "HoloScene.tsx"),
      "utf8",
    );
    for (const marker of ["<TransformControls", "onTransformCommit", "onTransformingChange"]) {
      if (!sceneView.includes(marker)) {
        throw new Error(`HoloForge transform controls missing packaged marker: ${marker}`);
      }
    }

    const alphaContour = await readFile(
      join(destination, "src", "intents", "design_editor", "geometry", "alpha-contour.ts"),
      "utf8",
    );
    for (const marker of ["traceAlphaContours", "largestAlphaContour", "normalizeContour"]) {
      if (!alphaContour.includes(marker)) {
        throw new Error(`HoloForge alpha geometry missing packaged marker: ${marker}`);
      }
    }

    const spectral = await readFile(
      join(destination, "src", "intents", "design_editor", "materials", "SpectralHoloMaterial.tsx"),
      "utf8",
    );
    for (const marker of ["ShaderMaterial", "uSpectralShift", "uDiffraction", "fresnel"]) {
      if (!spectral.includes(marker)) {
        throw new Error(`HoloForge spectral material missing packaged marker: ${marker}`);
      }
    }

    const exportContract = await readFile(
      join(destination, "src", "intents", "design_editor", "export", "export-contract.ts"),
      "utf8",
    );
    for (const marker of ['"scene-json"', '"glb"', '"usdz"', '"webm-alpha"', '"lightfield-quilt"', "render-worker", "device-adapter"]) {
      if (!exportContract.includes(marker)) {
        throw new Error(`HoloForge export contract missing packaged marker: ${marker}`);
      }
    }

    const keyframes = await readFile(
      join(destination, "src", "intents", "design_editor", "animation", "keyframe-model.ts"),
      "utf8",
    );
    for (const marker of ["upsertTransformPose", "sampleTransformTracks", "poseTimes"]) {
      if (!keyframes.includes(marker)) {
        throw new Error(`HoloForge keyframe engine missing packaged marker: ${marker}`);
      }
    }

    const sceneContract = await readFile(
      join(destination, "src", "intents", "design_editor", "scene", "holo-scene.ts"),
      "utf8",
    );
    for (const marker of ["schemaVersion: 1", "export type HoloScene", "createHoloScene"]) {
      if (!sceneContract.includes(marker)) {
        throw new Error(`HoloForge scene contract missing packaged marker: ${marker}`);
      }
    }

    const selectionSource = await readFile(
      join(destination, "src", "intents", "design_editor", "use-canva-image-selection.ts"),
      "utf8",
    );
    for (const marker of ["selection.registerOnChange", 'scope: "image"', "getTemporaryUrl"]) {
      if (!selectionSource.includes(marker)) {
        throw new Error(`HoloForge selected-image binding missing marker: ${marker}`);
      }
    }

    const derivedSource = await readFile(
      join(destination, "src", "intents", "design_editor", "holographic", "derived-image-adapter.ts"),
      "utf8",
    );
    for (const marker of ["applyHolographicPixels", "parentRef: sourceRef", "await asset.whenUploaded()"]) {
      if (!derivedSource.includes(marker)) {
        throw new Error(`HoloForge derived-image engine missing marker: ${marker}`);
      }
    }
  }

  if (app.includeBackend) {
    await cp(join(source, "backend"), join(destination, "backend"), { recursive: true });
  }
  await writeFile(join(destination, "START-HERE.html"), startHereHtml(app.displayName), "utf8");
  await writeFile(join(destination, "UPLOAD-TO-CANVA.txt"), uploadInstructions(app.displayName), "utf8");
  await writeFile(join(destination, "PACKAGE_CONTENTS.txt"), packageContents(app), "utf8");

  const manifest = JSON.parse(await readFile(join(destination, "canva-app.json"), "utf8"));
  if (manifest?.intent?.design_editor?.enrolled !== true) {
    throw new Error(`${app.displayName} manifest is not enrolled in the Canva Design Editor intent.`);
  }
  const permissions = new Set((manifest?.runtime?.permissions ?? []).map((entry) => entry?.name));
  for (const permission of ["canva:design:content:read", "canva:design:content:write", "canva:asset:private:write"]) {
    if (!permissions.has(permission)) {
      throw new Error(`${app.displayName} package is missing required Canva permission: ${permission}`);
    }
  }
  if (!permissions.has("canva:asset:private:read")) {
    throw new Error(`${app.displayName} package requires canva:asset:private:read for Canva image-source processing.`);
  }

  const packagedPackage = JSON.parse(await readFile(join(destination, "package.json"), "utf8"));
  if (packagedPackage?.name !== app.packageName) {
    throw new Error(`${app.displayName} package identity mismatch: expected ${app.packageName}, received ${packagedPackage?.name ?? "missing"}`);
  }

  const preview = await readFile(join(destination, "preview", "index.html"), "utf8");
  if (!preview.includes(app.displayName.toUpperCase())) {
    throw new Error(`${app.displayName} preview does not visibly identify the correct app.`);
  }

  const files = await listFiles(destination);
  for (const file of files) {
    const filePath = join(destination, file);
    await assertNonEmptyFile(filePath, `${app.displayName} package member`);
    if (
      file.includes("node_modules/") ||
      file === ".env" ||
      file.startsWith("reference/") ||
      file.startsWith("app/authenticated-v115/") ||
      file.startsWith("canva-app/")
    ) {
      throw new Error(`Forbidden package member: ${file}`);
    }
  }

  const expectedLogo = app.id === "holoforge-canva"
    ? "src/assets/holoforge-logo.svg"
    : "src/assets/depthpop-logo.svg";
  for (const required of [
    "app.js",
    "START-HERE.html",
    "preview/index.html",
    expectedLogo,
    "src/intents/design_editor/local-image-upload.tsx",
    "src/intents/design_editor/local-image-upload.test.tsx",
    ...(app.id === "holoforge-canva"
      ? [
          "src/intents/design_editor/use-canva-image-selection.ts",
          "src/intents/design_editor/holographic/derived-image-adapter.ts",
          "src/intents/design_editor/holographic/derived-image-adapter.test.ts",
          "src/intents/design_editor/scene/holo-scene.ts",
          "src/intents/design_editor/scene/holo-scene.test.ts",
          "src/intents/design_editor/scene/scene-store.ts",
          "src/intents/design_editor/materials/HoloMaterial.tsx",
          "src/intents/design_editor/materials/SpectralHoloMaterial.tsx",
          "src/intents/design_editor/animation/keyframe-model.ts",
          "src/intents/design_editor/animation/keyframe-model.test.ts",
          "src/intents/design_editor/animation/AnimationPanel.tsx",
          "src/intents/design_editor/export/export-contract.ts",
          "src/intents/design_editor/export/export-contract.test.ts",
          "src/intents/design_editor/export/scene-download.ts",
          "src/intents/design_editor/export/scene-download.test.ts",
          "src/intents/design_editor/export/ExportPanel.tsx",
          "src/intents/design_editor/export/export-client.ts",
          "src/intents/design_editor/geometry/alpha-contour.ts",
          "src/intents/design_editor/geometry/alpha-contour.test.ts",
          "src/intents/design_editor/geometry/use-alpha-shape.ts",
          "src/intents/design_editor/viewport/HoloViewport.tsx",
          "src/intents/design_editor/viewport/HoloScene.tsx",
          "src/intents/design_editor/viewport/HoloObject.tsx",
          "src/intents/design_editor/viewport/ObjectInspector.tsx",
        ]
      : []),
  ]) {
    if (!files.includes(required)) {
      throw new Error(`${app.displayName} package is missing required independent-app member: ${required}`);
    }
  }

  const legacyShellMarkers = [
    "Media Library",
    "Conversations",
    "New Chat",
    "R.O.A.R.Y Studio",
    "AETHER",
    "ÆTHER",
  ];
  for (const executable of ["app.js", "preview/index.html"]) {
    const executableText = await readFile(join(destination, executable), "utf8");
    for (const marker of legacyShellMarkers) {
      if (executableText.includes(marker)) {
        throw new Error(`${app.displayName} executable leaked historical ROARY/ÆTHER shell marker "${marker}" in ${executable}.`);
      }
    }
  }

  const uploadSource = await readFile(join(destination, "src", "intents", "design_editor", "local-image-upload.tsx"), "utf8");
  for (const marker of [
    "uploadDataUrlToCanva",
    "await upload({",
    "await asset.whenUploaded()",
    "await addElementAtPoint({",
    "MAX_DATA_URL_CHARACTERS",
    "insertIntoDesign",
    "htmlFor={inputId}",
    "onDrop=",
  ]) {
    if (!uploadSource.includes(marker)) {
      throw new Error(`${app.displayName} packaged upload implementation is missing required Canva upload marker: ${marker}`);
    }
  }

  if (app.includeBackend) {
    const backendRequired = [
      "backend/app.py",
      "backend/Dockerfile",
      "backend/requirements.txt",
      "backend/test_app.py",
      "backend/.env.example",
      ...(app.id === "holoforge-canva"
        ? [
            "backend/auth.py",
            "backend/models.py",
            "backend/repositories.py",
            "backend/renderers.py",
            "backend/export_service.py",
            "backend/blender_worker.py",
            "backend/Dockerfile.render",
            "backend/docker-compose.render.yml",
            "backend/render_smoke.py",
            "backend/source_geometry.py",
            "backend/test_source_geometry.py",
            "backend/spectral_material.py",
            "backend/test_spectral_material.py",
            "backend/test_models.py",
          ]
        : []),
    ];
    for (const required of backendRequired) {
      if (!files.includes(required)) {
        throw new Error(`${app.displayName} package is missing required backend file: ${required}`);
      }
    }
  }

  process.stdout.write(
    `${app.displayName} package ready: ${relative(root, destination)} (${files.length} files)\n`,
  );
}

const packagedNames = await Promise.all(
  APPS.map(async (app) => {
    const pkg = JSON.parse(await readFile(join(outputRoot, app.id, "package.json"), "utf8"));
    return pkg.name;
  }),
);
if (new Set(packagedNames).size !== APPS.length) {
  throw new Error("HoloForge and DepthPop packages must keep distinct package identities.");
}

const [holoBundle, depthBundle] = await Promise.all([
  readFile(join(outputRoot, "holoforge-canva", "app.js"), "utf8"),
  readFile(join(outputRoot, "depthpop-canva", "app.js"), "utf8"),
]);
if (holoBundle === depthBundle) {
  throw new Error("HoloForge and DepthPop compiled Canva bundles must not be identical.");
}
process.stdout.write("Independent Canva package identity check passed.\n");
