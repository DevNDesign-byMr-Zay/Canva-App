import type { HoloScene } from "../scene/holo-scene";

export type HoloExportFormat =
  | "scene-json"
  | "glb"
  | "gltf"
  | "usdz"
  | "webm-alpha"
  | "mp4"
  | "png-sequence"
  | "lightfield-quilt";

export type HoloExportProfile =
  | "scene-authoring"
  | "generic-3d"
  | "ios-ar"
  | "transparent-video"
  | "image-sequence"
  | "lightfield-quilt"
  | "custom";

export type ExportExecution = "client" | "render-worker" | "device-adapter";

export type ExportCapability = Readonly<{
  format: HoloExportFormat;
  profile: HoloExportProfile;
  label: string;
  extension: string;
  mimeType: string;
  execution: ExportExecution;
  ready: boolean;
  animated: boolean;
  description: string;
}>;

export const EXPORT_CAPABILITIES: readonly ExportCapability[] = Object.freeze([
  {
    format: "scene-json",
    profile: "scene-authoring",
    label: "HoloScene",
    extension: ".holoscene.json",
    mimeType: "application/json",
    execution: "client",
    ready: true,
    animated: true,
    description: "Lossless HoloForge scene snapshot including transforms, materials, camera, timeline and keyframes.",
  },
  {
    format: "glb",
    profile: "generic-3d",
    label: "GLB",
    extension: ".glb",
    mimeType: "model/gltf-binary",
    execution: "render-worker",
    ready: false,
    animated: true,
    description: "Portable binary glTF scene. Production export waits for the geometry/render worker so source meshes and animation clips stay faithful.",
  },
  {
    format: "gltf",
    profile: "generic-3d",
    label: "glTF",
    extension: ".gltf",
    mimeType: "model/gltf+json",
    execution: "render-worker",
    ready: false,
    animated: true,
    description: "Interchange-oriented glTF package produced by the geometry/render worker.",
  },
  {
    format: "usdz",
    profile: "ios-ar",
    label: "USDZ",
    extension: ".usdz",
    mimeType: "model/vnd.usdz+zip",
    execution: "render-worker",
    ready: false,
    animated: false,
    description: "AR-ready USDZ output. Requires worker-side material and geometry conversion.",
  },
  {
    format: "webm-alpha",
    profile: "transparent-video",
    label: "WebM Alpha",
    extension: ".webm",
    mimeType: "video/webm",
    execution: "render-worker",
    ready: false,
    animated: true,
    description: "Transparent animated hologram render for compositing and compatible display pipelines.",
  },
  {
    format: "mp4",
    profile: "transparent-video",
    label: "MP4 Preview",
    extension: ".mp4",
    mimeType: "video/mp4",
    execution: "render-worker",
    ready: false,
    animated: true,
    description: "Widely compatible review/preview render; transparency is not assumed.",
  },
  {
    format: "png-sequence",
    profile: "image-sequence",
    label: "PNG Sequence",
    extension: ".zip",
    mimeType: "application/zip",
    execution: "render-worker",
    ready: false,
    animated: true,
    description: "Frame-accurate transparent sequence for compositing, LED/display pipelines, and archival interchange.",
  },
  {
    format: "lightfield-quilt",
    profile: "lightfield-quilt",
    label: "Light-field Quilt",
    extension: ".png",
    mimeType: "image/png",
    execution: "device-adapter",
    ready: false,
    animated: false,
    description: "Multi-view quilt output. Tile count, view count, aspect and calibration must come from a selected device profile.",
  },
]);

export type LightfieldQuiltOptions = Readonly<{
  columns: number;
  rows: number;
  views: number;
  viewAspect: number;
}>;

export type HoloExportRequest = Readonly<{
  schemaVersion: 1;
  sceneId: string;
  format: HoloExportFormat;
  profile: HoloExportProfile;
  includeAnimation: boolean;
  resolution: Readonly<{ width: number; height: number }>;
  transparentBackground: boolean;
  quilt?: LightfieldQuiltOptions;
}>;

export function capabilityFor(format: HoloExportFormat): ExportCapability {
  const capability = EXPORT_CAPABILITIES.find((item) => item.format === format);
  if (!capability) throw new Error("Unknown HoloForge export format: " + format);
  return capability;
}

export function buildExportRequest(
  scene: HoloScene,
  format: HoloExportFormat,
  overrides: Partial<Pick<HoloExportRequest, "includeAnimation" | "resolution" | "transparentBackground" | "quilt">> = {},
): HoloExportRequest {
  const capability = capabilityFor(format);
  const request: HoloExportRequest = {
    schemaVersion: 1,
    sceneId: scene.id,
    format,
    profile: capability.profile,
    includeAnimation: overrides.includeAnimation ?? capability.animated,
    resolution: overrides.resolution ?? { width: 1920, height: 1080 },
    transparentBackground: overrides.transparentBackground ?? (
      format === "webm-alpha" ||
      format === "png-sequence" ||
      format === "lightfield-quilt"
    ),
    ...(overrides.quilt ? { quilt: overrides.quilt } : {}),
  };

  if (format === "lightfield-quilt" && !request.quilt) {
    throw new Error("A light-field quilt export requires an explicit device/profile layout.");
  }

  return Object.freeze(request);
}

export function serializeHoloScene(scene: HoloScene): string {
  return JSON.stringify(scene, null, 2);
}
