import fs from "node:fs";
import path from "node:path";

export function verifyServices({ root, APPS, full, readText, fail }) {
const holoExportClient = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/export/export-client.ts"),
);
for (const marker of [
  "auth.getCanvaUserToken",
  "prepareSceneForBackend",
  "createBackendExport",
  "waitForExport",
  "downloadBackendExport",
  '"glb"',
  '"gltf"',
  '"mp4"',
  '"png-sequence"',
]) {
  if (!holoExportClient.includes(marker)) {
    fail(`holoforge: render backend client marker missing: ${marker}`);
  }
}

const holoRenderDockerfile = readText(
  full(APPS.holoforge.root, "backend/Dockerfile.render"),
);
for (const marker of [
  "BLENDER_VERSION=4.5.14",
  "download.blender.org/release/Blender4.5",
  "sha256sum -c",
  "BLENDER_BIN=/opt/blender/blender",
  "/opt/blender/blender --background --version",
]) {
  if (!holoRenderDockerfile.includes(marker)) {
    fail(`holoforge: production render image marker missing: ${marker}`);
  }
}

const holoBlenderWorker = readText(
  full(APPS.holoforge.root, "backend/blender_worker.py"),
);
for (const marker of [
  'format_name == "webm-alpha"',
  "libvpx-vp9",
  "yuva420p",
  "alpha WebM",
]) {
  if (!holoBlenderWorker.includes(marker)) {
    fail(`holoforge: alpha WebM worker marker missing: ${marker}`);
  }
}

const holoRenderSmoke = readText(
  full(APPS.holoforge.root, "backend/render_smoke.py"),
);
for (const marker of [
  'format_name="glb"',
  'format_name="webm-alpha"',
  "blender_worker.py",
  "alphaextract",
  "alphaVerified",
  "result.json",
]) {
  if (!holoRenderSmoke.includes(marker)) {
    fail(`holoforge: Blender render smoke marker missing: ${marker}`);
  }
}

const holoBackend = readText(full(APPS.holoforge.root, "backend/app.py"));
for (const marker of [
  '"/api/v1/exports"',
  '"/api/v1/jobs/{job_id}"',
  'Depends(verify_canva_user)',
  "supportedFormats",
]) {
  if (!holoBackend.includes(marker)) {
    fail(`holoforge: export backend API marker missing: ${marker}`);
  }
}

const holoRenderer = readText(full(APPS.holoforge.root, "backend/renderers.py"));
for (const marker of [
  "SceneJsonRenderer",
  "BlenderRenderer",
  '"glb"',
  '"gltf"',
  '"webm-alpha"',
  '"mp4"',
  '"png-sequence"',
  "No configured HoloForge renderer",
]) {
  if (!holoRenderer.includes(marker)) {
    fail(`holoforge: render adapter marker missing: ${marker}`);
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
  'renderQuality: "cinematic"',
  "fast: 14",
  "balanced: 22",
  "cinematic: 34",
  "0.05, 0.75",
  "0, 100",
  "0.05, 1",
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
]) {
  if (!depthApp.includes(marker)) {
    fail(`depthpop: execution/UI marker missing: ${marker}`);
  }
}

if (!/<LocalImageUpload\s+productName\s*=\s*["']DepthPop["']/.test(depthApp)) {
  fail("depthpop: local image upload product name must remain DepthPop");
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

}
