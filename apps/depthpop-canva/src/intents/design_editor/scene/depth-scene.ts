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

export type SemanticObjectType =
  | "person"
  | "logo"
  | "text"
  | "product"
  | "building"
  | "vehicle"
  | "prop"
  | "unknown";

export interface DepthObject {
  id: string;
  label: string;
  semanticType: SemanticObjectType;
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
  animationTracks: unknown[];
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
  objects: DepthObject[];
  reconstructedPlate: ReconstructedPlate;
  camera: CameraConfig;
  timeline: TimelineConfig;
  createdAt: string;
  updatedAt: string;
}

export function isDepthObject(obj: unknown): obj is DepthObject {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Partial<DepthObject>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.label === "string" &&
    typeof o.semanticType === "string" &&
    typeof o.confidence === "number" &&
    o.confidence >= 0 &&
    o.confidence <= 1 &&
    typeof o.bbox === "object" &&
    o.bbox !== null &&
    typeof o.bbox.width === "number" &&
    o.bbox.width > 0 &&
    typeof o.assets === "object" &&
    o.assets !== null &&
    typeof o.assets.cutoutUrl === "string" &&
    typeof o.depth === "object" &&
    o.depth !== null &&
    typeof o.depth.mean === "number" &&
    o.depth.mean >= 0 &&
    o.depth.mean <= 1 &&
    typeof o.transform === "object" &&
    o.transform !== null
  );
}

export function isDepthScene(obj: unknown): obj is DepthScene {
  if (typeof obj !== "object" || obj === null) return false;
  const scene = obj as Partial<DepthScene>;
  return (
    scene.schemaVersion === 1 &&
    typeof scene.id === "string" &&
    scene.id.length > 0 &&
    typeof scene.sourceAssetId === "string" &&
    typeof scene.width === "number" &&
    scene.width > 0 &&
    typeof scene.height === "number" &&
    scene.height > 0 &&
    Array.isArray(scene.objects) &&
    scene.objects.every(isDepthObject) &&
    typeof scene.reconstructedPlate === "object" &&
    scene.reconstructedPlate !== null &&
    typeof scene.reconstructedPlate.imageUrl === "string"
  );
}
