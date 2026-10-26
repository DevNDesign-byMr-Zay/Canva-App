import fs from "node:fs";
import path from "node:path";

export function verifyHandoff({ root, APPS, full, readText, fail }) {
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


const depthSceneTs = readText(full(APPS.depthpop.root, "src/intents/design_editor/scene/depth-scene.ts"));
for (const marker of ["schemaVersion: 1", "sourceAssetId", "reconstructedPlate", "DepthObject"]) {
  if (!depthSceneTs.includes(marker)) {
    fail(`depthpop: scene contract marker missing: ${marker}`);
  }
}

const depthScenesApi = readText(full(APPS.depthpop.root, "backend/api/scenes.py"));
for (const marker of ["@router.post", "run_scene_decomposition_job", "max_objects", "animationTracks"]) {
  if (!depthScenesApi.includes(marker)) {
    fail(`depthpop backend: v1 scenes API marker missing: ${marker}`);
  }
}

const depthObjectApi = readText(full(APPS.depthpop.root, "backend/api/objects.py"));
for (const marker of [
  '"/{scene_id}/objects/{object_id}/duplicate"',
  '"/{scene_id}/objects/merge"',
  '"/{scene_id}/objects/{object_id}/split"',
  "SegmentationService",
]) {
  if (!depthObjectApi.includes(marker)) {
    fail(`depthpop backend: object-operation marker missing: ${marker}`);
  }
}

const depthExportApi = readText(full(APPS.depthpop.root, "backend/api/exports.py"));
for (const marker of [
  '"/scenes/{scene_id}/exports"',
  '"/exports/{job_id}"',
  '"/exports/{job_id}/cancel"',
  '"/artifacts/{artifact_id}/download"',
]) {
  if (!depthExportApi.includes(marker)) {
    fail(`depthpop backend: export API marker missing: ${marker}`);
  }
}

const depthExportFormats = readText(full(APPS.depthpop.root, "backend/services/export_formats.py")) + readText(full(APPS.depthpop.root, "backend/services/export_gltf.py"));
for (const marker of [
  "depthscene-portable-v1",
  "depthpop-layer-package-v1",
  "model/gltf-binary",
  "libx264",
  "libvpx-vp9",
]) {
  if (!depthExportFormats.includes(marker)) {
    fail(`depthpop backend: real export-format marker missing: ${marker}`);
  }
}

}
