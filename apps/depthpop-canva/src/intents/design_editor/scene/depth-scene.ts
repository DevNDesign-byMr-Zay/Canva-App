import {
  DEPTHPOP_QUALITY_STEPS,
  type DepthPopRenderQuality,
} from "../../../depthpop/depthpop-model";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectAssets {
  cutoutUrl: string;
  maskUrl: string;
  thumbnailUrl: string;
}

export interface ObjectDepthStats {
  mean: number;
  median: number;
  min: number;
  max: number;
}

export interface ObjectTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export type AnimationProperty =
  | "position.x"
  | "position.y"
  | "position.z"
  | "rotation.x"
  | "rotation.y"
  | "rotation.z"
  | "scale.x"
  | "scale.y"
  | "scale.z"
  | "opacity";

export type AnimationEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";

export interface AnimationKeyframe {
  timeMs: number;
  value: number;
  easing: AnimationEasing;
}

export interface AnimationTrack {
  id: string;
  property: AnimationProperty;
  keyframes: AnimationKeyframe[];
}

export interface DepthPopSceneSettings {
  depthStrength: number;
  depthBlur: number;
  depthFidelity: number;
  renderQuality: DepthPopRenderQuality;
  numInferenceSteps: number;
}

export type SemanticObjectType =
  | "person"
  | "logo"
  | "text"
  | "product"
  | "building"
  | "vehicle"
  | "prop"
  | "unknown";

export type ExtractionQuality = "mask" | "bbox_fallback";

export interface DepthObject {
  id: string;
  label: string;
  semanticType: SemanticObjectType;
  extractionQuality?: ExtractionQuality;
  confidence: number;
  bbox: BBox;
  assets: ObjectAssets;
  depth: ObjectDepthStats;
  transform: ObjectTransform;
  opacity: number;
  feather: number;
  visible: boolean;
  locked: boolean;
  order: number;
  animationTracks: AnimationTrack[];
}

export interface ReconstructedPlate {
  imageUrl: string;
  depthMapUrl: string;
}

export interface CameraConfig {
  position: Vector3;
  target: Vector3;
  fov: number;
}

export interface TimelineConfig {
  durationMs: number;
  fps: number;
  currentTimeMs: number;
}

export interface DepthScene {
  schemaVersion: 1;
  id: string;
  sourceAssetId: string;
  width: number;
  height: number;
  settings: DepthPopSceneSettings;
  objects: DepthObject[];
  reconstructedPlate: ReconstructedPlate;
  camera: CameraConfig;
  timeline: TimelineConfig;
  createdAt: string;
  updatedAt: string;
}

const animationProperties = new Set<AnimationProperty>([
  "position.x",
  "position.y",
  "position.z",
  "rotation.x",
  "rotation.y",
  "rotation.z",
  "scale.x",
  "scale.y",
  "scale.z",
  "opacity",
]);

const animationEasings = new Set<AnimationEasing>([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVector3(value: unknown): value is Vector3 {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.z)
  );
}

function isDepthPopSceneSettings(
  value: unknown,
): value is DepthPopSceneSettings {
  if (!isRecord(value)) return false;
  const quality = value.renderQuality;
  if (
    quality !== "fast" &&
    quality !== "balanced" &&
    quality !== "cinematic"
  ) {
    return false;
  }
  return (
    isFiniteNumber(value.depthStrength) &&
    value.depthStrength >= 0.05 &&
    value.depthStrength <= 0.75 &&
    isFiniteNumber(value.depthBlur) &&
    value.depthBlur >= 0 &&
    value.depthBlur <= 100 &&
    isFiniteNumber(value.depthFidelity) &&
    value.depthFidelity >= 0.05 &&
    value.depthFidelity <= 1 &&
    value.numInferenceSteps === DEPTHPOP_QUALITY_STEPS[quality]
  );
}

function isAnimationTrack(
  value: unknown,
  durationMs?: number,
): value is AnimationTrack {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id.trim()) return false;
  if (
    typeof value.property !== "string" ||
    !animationProperties.has(value.property as AnimationProperty)
  ) {
    return false;
  }
  if (!Array.isArray(value.keyframes) || value.keyframes.length === 0) {
    return false;
  }

  let previousTime = -1;
  for (const rawKeyframe of value.keyframes) {
    if (!isRecord(rawKeyframe)) return false;
    if (
      !Number.isInteger(rawKeyframe.timeMs) ||
      (rawKeyframe.timeMs as number) < 0 ||
      (durationMs !== undefined &&
        (rawKeyframe.timeMs as number) > durationMs) ||
      (rawKeyframe.timeMs as number) <= previousTime
    ) {
      return false;
    }
    if (!isFiniteNumber(rawKeyframe.value)) return false;
    if (
      value.property === "opacity" &&
      ((rawKeyframe.value as number) < 0 ||
        (rawKeyframe.value as number) > 1)
    ) {
      return false;
    }
    if (
      typeof rawKeyframe.easing !== "string" ||
      !animationEasings.has(rawKeyframe.easing as AnimationEasing)
    ) {
      return false;
    }
    previousTime = rawKeyframe.timeMs as number;
  }
  return true;
}

export function isDepthObject(
  obj: unknown,
  durationMs?: number,
): obj is DepthObject {
  if (!isRecord(obj)) return false;
  if (
    typeof obj.id !== "string" ||
    obj.id.length === 0 ||
    typeof obj.label !== "string" ||
    typeof obj.semanticType !== "string" ||
    (obj.extractionQuality !== undefined &&
      obj.extractionQuality !== "mask" &&
      obj.extractionQuality !== "bbox_fallback") ||
    !isFiniteNumber(obj.confidence) ||
    obj.confidence < 0 ||
    obj.confidence > 1 ||
    !isRecord(obj.bbox) ||
    !isFiniteNumber(obj.bbox.x) ||
    !isFiniteNumber(obj.bbox.y) ||
    !isFiniteNumber(obj.bbox.width) ||
    obj.bbox.width <= 0 ||
    !isFiniteNumber(obj.bbox.height) ||
    obj.bbox.height <= 0 ||
    !isRecord(obj.assets) ||
    typeof obj.assets.cutoutUrl !== "string" ||
    typeof obj.assets.maskUrl !== "string" ||
    typeof obj.assets.thumbnailUrl !== "string" ||
    !isRecord(obj.depth) ||
    !isFiniteNumber(obj.depth.mean) ||
    obj.depth.mean < 0 ||
    obj.depth.mean > 1 ||
    !isFiniteNumber(obj.depth.median) ||
    obj.depth.median < 0 ||
    obj.depth.median > 1 ||
    !isFiniteNumber(obj.depth.min) ||
    obj.depth.min < 0 ||
    obj.depth.min > 1 ||
    !isFiniteNumber(obj.depth.max) ||
    obj.depth.max < 0 ||
    obj.depth.max > 1 ||
    !isRecord(obj.transform) ||
    !isVector3(obj.transform.position) ||
    !isVector3(obj.transform.rotation) ||
    !isVector3(obj.transform.scale) ||
    !isFiniteNumber(obj.opacity) ||
    obj.opacity < 0 ||
    obj.opacity > 1 ||
    !isFiniteNumber(obj.feather) ||
    obj.feather < 0 ||
    obj.feather > 100 ||
    typeof obj.visible !== "boolean" ||
    typeof obj.locked !== "boolean" ||
    !Number.isInteger(obj.order) ||
    (obj.order as number) < 0 ||
    !Array.isArray(obj.animationTracks)
  ) {
    return false;
  }

  return obj.animationTracks.every((track) =>
    isAnimationTrack(track, durationMs),
  );
}

export function isDepthScene(obj: unknown): obj is DepthScene {
  if (!isRecord(obj)) return false;
  if (
    obj.schemaVersion !== 1 ||
    typeof obj.id !== "string" ||
    obj.id.length === 0 ||
    typeof obj.sourceAssetId !== "string" ||
    !isFiniteNumber(obj.width) ||
    obj.width <= 0 ||
    !isFiniteNumber(obj.height) ||
    obj.height <= 0 ||
    !isDepthPopSceneSettings(obj.settings) ||
    !Array.isArray(obj.objects) ||
    !isRecord(obj.reconstructedPlate) ||
    typeof obj.reconstructedPlate.imageUrl !== "string" ||
    typeof obj.reconstructedPlate.depthMapUrl !== "string" ||
    !isRecord(obj.camera) ||
    !isVector3(obj.camera.position) ||
    !isVector3(obj.camera.target) ||
    !isFiniteNumber(obj.camera.fov) ||
    obj.camera.fov <= 0 ||
    obj.camera.fov >= 180 ||
    !isRecord(obj.timeline) ||
    !Number.isInteger(obj.timeline.durationMs) ||
    (obj.timeline.durationMs as number) < 0 ||
    !Number.isInteger(obj.timeline.fps) ||
    (obj.timeline.fps as number) < 1 ||
    (obj.timeline.fps as number) > 120 ||
    !Number.isInteger(obj.timeline.currentTimeMs) ||
    (obj.timeline.currentTimeMs as number) < 0 ||
    (obj.timeline.currentTimeMs as number) >
      (obj.timeline.durationMs as number) ||
    typeof obj.createdAt !== "string" ||
    typeof obj.updatedAt !== "string"
  ) {
    return false;
  }

  const durationMs = obj.timeline.durationMs as number;
  if (!obj.objects.every((item) => isDepthObject(item, durationMs))) {
    return false;
  }

  const ids = new Set<string>();
  for (const item of obj.objects as DepthObject[]) {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}
