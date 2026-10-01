import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const APPS = {
  holoforge: {
    root: "apps/holoforge-canva",
    logo: "src/assets/holoforge-logo.svg",
    required: [
      "package.json",
      "canva-app.json",
      "tsconfig.json",
      "README.md",
      "preview/index.html",
      "src/index.tsx",
      "src/intents/design_editor/index.tsx",
      "src/intents/design_editor/app.tsx",
      "src/intents/design_editor/app.css",
      "src/intents/design_editor/local-image-upload.tsx",
      "src/intents/design_editor/local-image-upload.test.tsx",
      "src/intents/design_editor/holographic/app-owned-effect-adapter.ts",
      "src/intents/design_editor/holographic/derived-image-adapter.ts",
      "src/intents/design_editor/holographic/derived-image-adapter.test.ts",
      "src/intents/design_editor/holographic/effect-executor.ts",
      "src/intents/design_editor/holographic/effect-plan.ts",
      "src/intents/design_editor/holographic/forge-support.ts",
      "src/intents/design_editor/holographic/material-contract.ts",
      "src/intents/design_editor/scene/holo-scene.ts",
      "src/intents/design_editor/scene/holo-scene.test.ts",
      "src/intents/design_editor/scene/holo-object.ts",
      "src/intents/design_editor/scene/scene-store.ts",
      "src/intents/design_editor/scene/scene-store.test.ts",
      "src/intents/design_editor/materials/HoloMaterial.tsx",
      "src/intents/design_editor/materials/SpectralHoloMaterial.tsx",
      "src/intents/design_editor/geometry/alpha-contour.ts",
      "src/intents/design_editor/geometry/alpha-contour.test.ts",
      "src/intents/design_editor/geometry/use-alpha-shape.ts",
      "src/intents/design_editor/viewport/HoloCamera.tsx",
      "src/intents/design_editor/viewport/HoloObject.tsx",
      "src/intents/design_editor/viewport/HoloScene.tsx",
      "src/intents/design_editor/viewport/HoloViewport.tsx",
      "src/intents/design_editor/viewport/ObjectInspector.tsx",
      "src/intents/design_editor/viewport/StageEnvironment.tsx",
      "src/intents/design_editor/use-canva-image-selection.ts",
      "src/assets/holoforge-logo.svg",
    ],
    forbiddenText: [
      "__MRZAY_CANVA_PRODUCT__",
      "DepthPopPanel",
      "Media Library",
      "Conversations",
      "New Chat",
      "R.O.A.R.Y Studio",
      "AETHER",
      "ÆTHER",
    ],
  },
  depthpop: {
    root: "apps/depthpop-canva",
    logo: "src/assets/depthpop-logo.svg",
    required: [
      "package.json",
      "canva-app.json",
      "tsconfig.json",
      ".env.template",
      "README.md",
      "preview/index.html",
      "src/index.tsx",
      "src/intents/design_editor/index.tsx",
      "src/intents/design_editor/app.tsx",
      "src/intents/design_editor/app.css",
      "src/intents/design_editor/local-image-upload.tsx",
      "src/intents/design_editor/local-image-upload.test.tsx",
      "src/depthpop/depthpop-model.ts",
      "src/assets/depthpop-logo.svg",
      "backend/app.py",
      "backend/requirements.txt",
      "backend/Dockerfile",
      "backend/.env.example",
      "backend/README.md",
      "backend/test_app.py",
      "reference/DRIVE_SOURCE.md",
      "reference/drive-source/roaryv246_v115_depthpop_modeldrawer_FINALFIX.html",
      "reference/drive-source/roary_router_5055_SEARCH_FIXED_v261_depthpop_progress_v3.py.txt",
    ],
    forbiddenText: [
      "__MRZAY_CANVA_PRODUCT__",
      "HoloForgeScenario",
      "Media Library",
      "Conversations",
      "New Chat",
      "R.O.A.R.Y Studio",
      "AETHER",
      "ÆTHER",
    ],
  },
};

const failures = [];

const fail = (message) => failures.push(message);
const full = (appRoot, rel) => path.join(root, appRoot, rel);
const readText = (file) => fs.readFileSync(file, "utf8");

for (const [name, spec] of Object.entries(APPS)) {
  for (const rel of spec.required) {
    const file = full(spec.root, rel);
    if (!fs.existsSync(file)) {
      fail(`${name}: missing required file ${rel}`);
      continue;
    }
    if (fs.statSync(file).isFile() && fs.statSync(file).size === 0) {
      fail(`${name}: required file is empty ${rel}`);
    }
  }

  const manifestPath = full(spec.root, "canva-app.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(readText(manifestPath));
    if (manifest?.intent?.design_editor?.enrolled !== true) {
      fail(`${name}: Canva Design Editor intent is not enrolled`);
    }
    const permissions = new Set(
      (manifest?.runtime?.permissions ?? []).map((permission) => permission?.name),
    );
    const requiredPermissions = [
      "canva:design:content:read",
      "canva:design:content:write",
      "canva:asset:private:write",
    ];
    requiredPermissions.push("canva:asset:private:read");
    for (const requiredPermission of requiredPermissions) {
      if (!permissions.has(requiredPermission)) {
        fail(`${name}: missing Canva permission ${requiredPermission}`);
      }
    }
  }

  const packagePath = full(spec.root, "package.json");
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(readText(packagePath));
    for (const scriptName of ["build", "typecheck", "test"]) {
      if (!pkg?.scripts?.[scriptName]) {
        fail(`${name}: package.json is missing ${scriptName} script`);
      }
    }
    const requiredDependencies =
      name === "holoforge"
        ? ["@canva/asset", "@canva/design", "three", "@react-three/fiber", "@react-three/drei"]
        : ["@canva/asset", "@canva/design"];
    for (const dependency of requiredDependencies) {
      if (!pkg?.dependencies?.[dependency]) {
        fail(`${name}: package.json is missing ${dependency} required for test-image upload/add-to-design`);
      }
    }
  }

  const preview = full(spec.root, "preview/index.html");
  if (fs.existsSync(preview)) {
    const previewText = readText(preview);
    if (!previewText.includes("../" + spec.logo)) {
      fail(`${name}: preview does not reference packaged logo ${spec.logo}`);
    }
    if (
      !previewText.includes("type=\"file\"") ||
      !previewText.includes('accept="image/png,image/jpeg,image/webp"')
    ) {
      fail(`${name}: preview is missing its local PNG/JPEG/WebP file picker`);
    }
  }

  const sourceRoot = full(spec.root, "src");
  if (fs.existsSync(sourceRoot)) {
    const queue = [sourceRoot];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const item = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(item);
        } else if (/\.(?:ts|tsx|js|jsx|css|html)$/u.test(entry.name)) {
          const source = readText(item);
          for (const forbidden of spec.forbiddenText) {
            if (source.includes(forbidden)) {
              fail(
                `${name}: forbidden cross-product/runtime-switcher reference "${forbidden}" in ${path.relative(root, item)}`,
              );
            }
          }
        }
      }
    }
  }

  const uploadSource = full(spec.root, "src/intents/design_editor/local-image-upload.tsx");
  if (fs.existsSync(uploadSource)) {
    const uploadText = readText(uploadSource);
    for (const marker of [
      "CHOOSE IMAGE",
      "readAsDataUrl",
      "uploadDataUrlToCanva",
      "MAX_DATA_URL_CHARACTERS",
      "await upload({",
      "name: input.fileName",
      "await asset.whenUploaded()",
      "await addElementAtPoint({",
      "insertIntoDesign",
      "htmlFor={inputId}",
      "onDrop=",
      'accept="image/png,image/jpeg,image/webp"',
      "7 * 1024 * 1024",
      "10 * 1024 * 1024",
    ]) {
      if (!uploadText.includes(marker)) {
        fail(`${name}: test-image upload marker missing: ${marker}`);
      }
    }
  }
}

const holoPackage = JSON.parse(readText(full(APPS.holoforge.root, "package.json")));
const depthPackage = JSON.parse(readText(full(APPS.depthpop.root, "package.json")));
if (holoPackage.name !== "holoforge-canva-app") {
  fail(`holoforge: unexpected package identity ${holoPackage.name ?? "missing"}`);
}
if (depthPackage.name !== "depthpop-canva-app") {
  fail(`depthpop: unexpected package identity ${depthPackage.name ?? "missing"}`);
}
if (holoPackage.name === depthPackage.name) {
  fail("packaging: HoloForge and DepthPop must remain distinct Canva app packages");
}

const depthModel = readText(full(APPS.depthpop.root, "src/depthpop/depthpop-model.ts"));
for (const contract of [
  "depthStrength: 0.32",
  "depthBlur: 35",
  "depthFidelity: 0.95",
  "steps: 28",
  "0.05, 0.75",
  "0, 100",
  "0.05, 1",
  "8, 50",
]) {
  if (!depthModel.includes(contract)) {
    fail(`depthpop: Drive v115 contract marker missing: ${contract}`);
  }
}

const depthApp = readText(full(APPS.depthpop.root, "src/intents/design_editor/app.tsx"));
for (const marker of [
  "getTemporaryUrl",
  "buildDepthPopFormFields",
  'fetch(host + "/api/depthpop"',
  "await upload({",
  "parentRef: content.ref",
  "await asset.whenUploaded()",
  "content.ref = asset.ref",
  "await draft.save()",
  "<DepthPopLogo />",
  '<LocalImageUpload productName="DepthPop"',
]) {
  if (!depthApp.includes(marker)) {
    fail(`depthpop: execution/UI marker missing: ${marker}`);
  }
}

const backend = readText(full(APPS.depthpop.root, "backend/app.py"));
for (const marker of [
  'title="DepthPop Canva Backend"',
  "verify_canva_user",
  "fal_client",
  "depth-anything",
  "_render_depthpop",
  '@app.post("/api/depthpop"',
  '@app.get("/cache/image/{image_id}")',
]) {
  if (!backend.includes(marker)) {
    fail(`depthpop backend: required runtime marker missing: ${marker}`);
  }
}

const holoApp = readText(full(APPS.holoforge.root, "src/intents/design_editor/app.tsx"));
for (const marker of [
  "<HoloForgeLogo />",
  "<LocalImageUpload",
  'productName="HoloForge"',
  "executeHolographicEffectPlan",
  "createHoloScene",
  "<HoloViewport",
]) {
  if (!holoApp.includes(marker)) {
    fail(`holoforge: runtime/UI marker missing: ${marker}`);
  }
}

const holoViewport = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/viewport/HoloViewport.tsx"),
);
for (const marker of [
  'from "@react-three/fiber"',
  'from "@react-three/drei"',
  "<Canvas",
  "<OrbitControls",
  "<HoloScene",
  "<ObjectInspector",
  "transformMode",
  "WEBGL LIVE",
  "AUTO ORBIT",
  "HoloForge timeline",
]) {
  if (!holoViewport.includes(marker)) {
    fail(`holoforge: WebGL viewport marker missing: ${marker}`);
  }
}

const holoSceneView = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/viewport/HoloScene.tsx"),
);
for (const marker of [
  "<TransformControls",
  'mode={mode}',
  "onTransformCommit",
  "onTransformingChange",
]) {
  if (!holoSceneView.includes(marker)) {
    fail(`holoforge: 3D transform-gizmo marker missing: ${marker}`);
  }
}

const holoAlphaContour = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/geometry/alpha-contour.ts"),
);
for (const marker of [
  "traceAlphaContours",
  "largestAlphaContour",
  "normalizeContour",
  "boundaryEdges",
]) {
  if (!holoAlphaContour.includes(marker)) {
    fail(`holoforge: alpha silhouette marker missing: ${marker}`);
  }
}

const holoObjectView = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/viewport/HoloObject.tsx"),
);
for (const marker of [
  "useAlphaShape",
  "<extrudeGeometry",
  "forwardRef<Group",
  "alphaShape.shape",
]) {
  if (!holoObjectView.includes(marker)) {
    fail(`holoforge: extruded source-object marker missing: ${marker}`);
  }
}

const spectralMaterial = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/materials/SpectralHoloMaterial.tsx"),
);
for (const marker of [
  "ShaderMaterial",
  "uSpectralShift",
  "uDiffraction",
  "fresnel",
  "spectral(",
  "uTime",
]) {
  if (!spectralMaterial.includes(marker)) {
    fail(`holoforge: spectral shader marker missing: ${marker}`);
  }
}

const holoSceneContract = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/scene/holo-scene.ts"),
);
for (const marker of [
  "schemaVersion: 1",
  "export type HoloScene",
  "export type HoloObject",
  "export type HoloMaterialSpec",
  "export type HoloTimeline",
  "createHoloScene",
  "validateHoloScene",
]) {
  if (!holoSceneContract.includes(marker)) {
    fail(`holoforge: canonical scene contract marker missing: ${marker}`);
  }
}

if (holoApp.includes("hf-hologram") || holoApp.includes("hf-holo-plane")) {
  fail("holoforge: app.tsx still references the retired CSS pseudo-3D renderer");
}

const holoSelection = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/use-canva-image-selection.ts"),
);
for (const marker of [
  'selection.registerOnChange({',
  'scope: "image"',
  "getTemporaryUrl",
  "draft.contents[0]?.ref",
]) {
  if (!holoSelection.includes(marker)) {
    fail(`holoforge: selected-image binding marker missing: ${marker}`);
  }
}

const holoDerived = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/holographic/derived-image-adapter.ts"),
);
for (const marker of [
  "applyHolographicPixels",
  "getTemporaryUrl",
  "parentRef: sourceRef",
  "await asset.whenUploaded()",
  "await addElementAtPoint({",
]) {
  if (!holoDerived.includes(marker)) {
    fail(`holoforge: derived hologram marker missing: ${marker}`);
  }
}

const holoExecutor = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/holographic/effect-executor.ts"),
);
for (const marker of [
  '"DERIVED_IMAGE"',
  '"APP_OWNED_EFFECT"',
  'plan.creationType === "holo_logo"',
  'plan.creationType === "holo_graphic" && plan.sourceImageRef',
  "sourceText",
]) {
  if (!holoExecutor.includes(marker)) {
    fail(`holoforge: functional route marker missing: ${marker}`);
  }
}

const holoForgeSupport = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/holographic/forge-support.ts"),
);
for (const marker of [
  'holo_text: Object.freeze({',
  'holo_logo: Object.freeze({',
  'holo_graphic: Object.freeze({',
  'glass: Object.freeze({',
  'chrome: Object.freeze({',
  'light_fx: Object.freeze({',
  'requiredSource: "text"',
  'requiredSource: "image"',
  'route: "HYBRID"',
]) {
  if (!holoForgeSupport.includes(marker)) {
    fail(`holoforge: creation-type capability marker missing: ${marker}`);
  }
}

const holoAdapter = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/holographic/app-owned-effect-adapter.ts"),
);
for (const marker of ["initAppElement", "appElementClient.addElement", "renderHolographicSvg"]) {
  if (!holoAdapter.includes(marker)) {
    fail(`holoforge: editable Canva app-element marker missing: ${marker}`);
  }
}

const packagerPath = path.join(root, "scripts/package-independent-canva-apps.mjs");
if (fs.existsSync(packagerPath)) {
  const packager = readText(packagerPath);
  for (const marker of [
    "src/assets/holoforge-logo.svg",
    "src/assets/depthpop-logo.svg",
    "image source workflow",
    "Historical Drive sources remain in the GitHub repository for provenance only",
    'includeReference: false',
    'file.startsWith("reference/")',
    '"Media Library"',
    '"R.O.A.R.Y Studio"',
  ]) {
    if (!packager.includes(marker)) {
      fail(`packaging: independent-app package guard missing: ${marker}`);
    }
  }
}

if (failures.length) {
  console.error("\nStandalone Canva app verification failed:\n");
  for (const message of failures) console.error(" - " + message);
  process.exit(1);
}

console.log("Standalone Canva app verification passed.");
console.log(" - HoloForge: independent app + real WebGL scene + transform gizmos + alpha-silhouette extrusion + spectral shader + Canva forge routes");
console.log(" - DepthPop: independent app + embedded/packaged logo + Canva test-image upload + Drive v115 processing contract");
console.log(" - DepthPop backend: auth, provider, render, cache, tests, Docker and deployment files present");
console.log(" - No shared HoloForge/DepthPop product-switch runtime detected");
console.log(" - User-facing packages exclude historical ROARY/ÆTHER shell and Drive provenance source files");
