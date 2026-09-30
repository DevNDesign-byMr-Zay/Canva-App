import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const apps = {
  holoforge: {
    root: "apps/holoforge-canva",
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
      "src/intents/design_editor/holographic/app-owned-effect-adapter.ts",
      "src/intents/design_editor/holographic/effect-executor.ts",
      "src/intents/design_editor/holographic/effect-plan.ts",
      "src/intents/design_editor/holographic/forge-support.ts",
      "src/intents/design_editor/holographic/material-contract.ts",
    ],
    forbiddenText: ["__MRZAY_CANVA_PRODUCT__", "DepthPopPanel"],
  },
  depthpop: {
    root: "apps/depthpop-canva",
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
      "src/depthpop/depthpop-model.ts",
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
    forbiddenText: ["__MRZAY_CANVA_PRODUCT__", "HoloForgeScenario"],
  },
};

const failures = [];

function fail(message) {
  failures.push(message);
}

function full(appRoot, rel) {
  return path.join(root, appRoot, rel);
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

for (const [name, spec] of Object.entries(apps)) {
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
  }

  const packagePath = full(spec.root, "package.json");
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(readText(packagePath));
    for (const scriptName of ["build", "typecheck", "test"]) {
      if (!pkg?.scripts?.[scriptName]) {
        fail(`${name}: package.json is missing ${scriptName} script`);
      }
    }
  }

  const sourceRoot = full(spec.root, "src");
  if (fs.existsSync(sourceRoot)) {
    const queue = [sourceRoot];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const item = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(item);
        else if (/\.(?:ts|tsx|js|jsx|css|html)$/u.test(entry.name)) {
          const text = readText(item);
          for (const forbidden of spec.forbiddenText) {
            if (text.includes(forbidden)) {
              fail(`${name}: forbidden cross-product/runtime-switcher reference "${forbidden}" in ${path.relative(root, item)}`);
            }
          }
        }
      }
    }
  }
}

const depthModel = readText(full(apps.depthpop.root, "src/depthpop/depthpop-model.ts"));
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

const depthApp = readText(full(apps.depthpop.root, "src/intents/design_editor/app.tsx"));
for (const marker of [
  "getTemporaryUrl",
  "buildDepthPopFormFields",
  'fetch(host + "/api/depthpop"',
  "await upload({",
  "parentRef: content.ref",
  "await asset.whenUploaded()",
  "content.ref = asset.ref",
  "await draft.save()",
]) {
  if (!depthApp.includes(marker)) {
    fail(`depthpop: execution pipeline marker missing: ${marker}`);
  }
}

const backend = readText(full(apps.depthpop.root, "backend/app.py"));
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

const holoAdapter = readText(full(apps.holoforge.root, "src/intents/design_editor/holographic/app-owned-effect-adapter.ts"));
for (const marker of [
  "initAppElement",
  "appElementClient.addElement",
  "renderHolographicSvg",
]) {
  if (!holoAdapter.includes(marker)) {
    fail(`holoforge: editable Canva app-element marker missing: ${marker}`);
  }
}

if (failures.length) {
  console.error("\nStandalone Canva app verification failed:\n");
  for (const message of failures) console.error(" - " + message);
  process.exit(1);
}

console.log("Standalone Canva app verification passed.");
console.log(" - HoloForge: independent app root + editable app-element execution path");
console.log(" - DepthPop: Drive v115 UI contract + Canva selection-to-backend-to-replacement path");
console.log(" - DepthPop backend: provider, auth, render, cache, and deployment files present");
