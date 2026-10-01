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

export function isDepthScene(obj: unknown): obj is DepthScene {
  if (typeof obj !== "object" || obj === null) return false;
  const scene = obj as Partial<DepthScene>;
  return (
    scene.schemaVersion === 1 &&
    typeof scene.id === "string" &&
    typeof scene.sourceAssetId === "string" &&
    typeof scene.width === "number" &&
    typeof scene.height === "number" &&
    Array.isArray(scene.objects) &&
    typeof scene.reconstructedPlate === "object" &&
    scene.reconstructedPlate !== null
  );
}
