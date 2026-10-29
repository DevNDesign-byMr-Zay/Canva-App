import fs from "node:fs";
import path from "node:path";

export function verifyHoloForge({ root, APPS, full, readText, fail }) {
const holoApp = readText(full(APPS.holoforge.root, "src/intents/design_editor/app.tsx"));
for (const marker of [
  "<HoloForgeLogo />",
  "<LocalImageUpload",
  'productName="HoloForge"',
  "executeHolographicEffectPlan",
  "createHoloScene",
  "<SpatialPreview",
  "<VerifyPanel",
  'from "./studio-panels"',
]) {
  if (!holoApp.includes(marker)) {
    fail(`holoforge: runtime/UI marker missing: ${marker}`);
  }
}

const studioPanels = readText(full(APPS.holoforge.root, "src/intents/design_editor/studio-panels.tsx"));
for (const marker of ["export function SpatialPreview", "export function VerifyPanel", "<HoloViewport", "scene={scene}", "onSceneChange={onSceneChange}"]) {
  if (!studioPanels.includes(marker)) {
    fail(`holoforge: studio panel marker missing: ${marker}`);
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
  "<AnimationPanel",
  "<ExportPanel",
  "transformMode",
  "requestAnimationFrame",
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

const holoExportContract = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/export/export-contract.ts"),
);
for (const marker of [
  '"scene-json"',
  '"glb"',
  '"gltf"',
  '"usdz"',
  '"webm-alpha"',
  '"png-sequence"',
  '"lightfield-quilt"',
  "render-worker",
  "device-adapter",
  "buildExportRequest",
]) {
  if (!holoExportContract.includes(marker)) {
    fail(`holoforge: export contract marker missing: ${marker}`);
  }
}

const holoExportPanel = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/export/ExportPanel.tsx"),
);
for (const marker of [
  "DOWNLOAD",
  "WORKER READY",
  "DEVICE ADAPTER NOT IMPLEMENTED",
  "downloadHoloScene",
  "portable source assets",
  "createBackendExport",
  "waitForExport",
  "downloadBackendExport",
]) {
  if (!holoExportPanel.includes(marker)) {
    fail(`holoforge: export UI marker missing: ${marker}`);
  }
}

const holoSceneImport = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/export/scene-import.ts"),
);
for (const marker of [
  "parseHoloSceneJson",
  "readHoloSceneFile",
  "validateHoloScene",
  "isPortableImageUrl",
  "deepFreeze",
]) {
  if (!holoSceneImport.includes(marker)) {
    fail(`holoforge: scene import marker missing: ${marker}`);
  }
}

const holoSceneImportControl = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/export/SceneImportControl.tsx"),
);
for (const marker of [
  "HOLOSCENE PROJECT",
  "readHoloSceneFile",
  "onImported",
]) {
  if (!holoSceneImportControl.includes(marker)) {
    fail(`holoforge: scene import control marker missing: ${marker}`);
  }
}

const holoKeyframes = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/animation/keyframe-model.ts"),
);
for (const marker of [
  "upsertTransformPose",
  "removePoseAtTime",
  "sampleTransformTracks",
  "poseTimes",
  "ease-in-out",
]) {
  if (!holoKeyframes.includes(marker)) {
    fail(`holoforge: keyframe animation marker missing: ${marker}`);
  }
}

const holoAnimationPanel = readText(
  full(APPS.holoforge.root, "src/intents/design_editor/animation/AnimationPanel.tsx"),
);
for (const marker of [
  "ADD POSE",
  "REMOVE POSE",
  "TIME / MOTION",
  "onPresetChange",
  "onClearAnimation",
]) {
  if (!holoAnimationPanel.includes(marker)) {
    fail(`holoforge: animation authoring UI marker missing: ${marker}`);
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
  "export type HoloAnimationTrack",
  "export type HoloKeyframe",
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

}
