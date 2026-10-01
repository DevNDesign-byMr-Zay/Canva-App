import {
  validateHoloScene,
  type HoloAnimationEasing,
  type HoloAnimationPreset,
  type HoloAnimationProperty,
  type HoloGeometryType,
  type HoloScene,
  type HoloSourceType,
} from "../scene/holo-scene";
import type { CreationType, MaterialFamily } from "../holographic/material-contract";

type UnknownRecord = Record<string, unknown>;

const SOURCE_TYPES = new Set<HoloSourceType>([
  "raster",
  "vector",
  "text",
  "canva",
  "generated",
]);

const GEOMETRY_TYPES = new Set<HoloGeometryType>([
  "extruded-shape",
  "plane",
  "text",
  "mesh",
]);

const CREATION_TYPES = new Set<CreationType>([
  "holo_text",
  "holo_logo",
  "holo_graphic",
  "glass",
  "chrome",
  "light_fx",
]);

const MATERIAL_FAMILIES = new Set<MaterialFamily>([
  "iridescent",
  "glass",
  "foil",
  "metal",
  "pearl",
  "neon",
  "crystal",
]);

const ANIMATION_PRESETS = new Set<HoloAnimationPreset>([
  "static",
  "turntable",
  "shimmer",
  "sweep",
  "pulse",
  "orbit",
  "custom",
]);

const ANIMATION_PROPERTIES = new Set<HoloAnimationProperty>([
  "position",
  "rotation",
  "scale",
]);

const EASINGS = new Set<HoloAnimationEasing>([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isPortableImageUrl(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  if (value.length > 20 * 1024 * 1024) return false;
  return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/iu.test(value);
}

function isVec3(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.z)
  );
}

function isTransform(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isVec3(value.position) || !isVec3(value.rotation) || !isVec3(value.scale)) {
    return false;
  }
  const scale = value.scale as UnknownRecord;
  return (
    (scale.x as number) > 0 &&
    (scale.y as number) > 0 &&
    (scale.z as number) > 0
  );
}

function isMaterial(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.family === "string" &&
    MATERIAL_FAMILIES.has(value.family as MaterialFamily) &&
    isNonEmptyString(value.baseColor) &&
    isFiniteNumber(value.opacity) &&
    value.opacity >= 0 &&
    value.opacity <= 1 &&
    isFiniteNumber(value.metalness) &&
    value.metalness >= 0 &&
    value.metalness <= 1 &&
    isFiniteNumber(value.roughness) &&
    value.roughness >= 0 &&
    value.roughness <= 1 &&
    isFiniteNumber(value.transmission) &&
    value.transmission >= 0 &&
    value.transmission <= 1 &&
    isFiniteNumber(value.ior) &&
    value.ior > 0 &&
    value.ior <= 5 &&
    isNonEmptyString(value.emissionColor) &&
    isFiniteNumber(value.emissionStrength) &&
    value.emissionStrength >= 0 &&
    value.emissionStrength <= 20 &&
    isFiniteNumber(value.spectralShift) &&
    value.spectralShift >= 0 &&
    value.spectralShift <= 100 &&
    isFiniteNumber(value.diffraction) &&
    value.diffraction >= 0 &&
    value.diffraction <= 2 &&
    isFiniteNumber(value.scanlineStrength) &&
    value.scanlineStrength >= 0 &&
    value.scanlineStrength <= 2 &&
    isFiniteNumber(value.shimmerStrength) &&
    value.shimmerStrength >= 0 &&
    value.shimmerStrength <= 2 &&
    isFiniteNumber(value.reflectionStrength) &&
    value.reflectionStrength >= 0 &&
    value.reflectionStrength <= 100
  );
}

function isGeometry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === "string" &&
    GEOMETRY_TYPES.has(value.type as HoloGeometryType) &&
    isPortableImageUrl(value.sourceUrl) &&
    isFiniteNumber(value.thickness) &&
    value.thickness >= 0 &&
    value.thickness <= 20 &&
    isFiniteNumber(value.bevelSize) &&
    value.bevelSize >= 0 &&
    value.bevelSize <= 10 &&
    Number.isInteger(value.bevelSegments) &&
    (value.bevelSegments as number) >= 0 &&
    (value.bevelSegments as number) <= 32 &&
    isOptionalString(value.meshUrl) &&
    value.meshUrl === undefined
  );
}

function isKeyframe(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    Number.isInteger(value.timeMs) &&
    (value.timeMs as number) >= 0 &&
    isVec3(value.value) &&
    typeof value.easing === "string" &&
    EASINGS.has(value.easing as HoloAnimationEasing)
  );
}

function isTrack(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    typeof value.property === "string" &&
    ANIMATION_PROPERTIES.has(value.property as HoloAnimationProperty) &&
    Array.isArray(value.keyframes) &&
    value.keyframes.every(isKeyframe)
  );
}

function isHoloObject(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.creationType === "string" &&
    CREATION_TYPES.has(value.creationType as CreationType) &&
    isGeometry(value.geometry) &&
    isMaterial(value.material) &&
    isTransform(value.transform) &&
    typeof value.animationPreset === "string" &&
    ANIMATION_PRESETS.has(value.animationPreset as HoloAnimationPreset) &&
    Array.isArray(value.animationTracks) &&
    value.animationTracks.every(isTrack) &&
    isOptionalString(value.sourceText) &&
    typeof value.visible === "boolean"
  );
}

function isSource(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === "string" &&
    SOURCE_TYPES.has(value.type as HoloSourceType) &&
    isOptionalString(value.assetId) &&
    isPortableImageUrl(value.previewUrl) &&
    isOptionalString(value.text)
  );
}

function isEnvironment(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.background) &&
    isFiniteNumber(value.ambientIntensity) &&
    isFiniteNumber(value.keyLightIntensity) &&
    isFiniteNumber(value.rimLightIntensity) &&
    typeof value.floorGrid === "boolean"
  );
}

function isCamera(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isVec3(value.position) &&
    isVec3(value.target) &&
    isFiniteNumber(value.fov) &&
    value.fov > 0 &&
    value.fov < 180 &&
    isFiniteNumber(value.near) &&
    value.near > 0 &&
    isFiniteNumber(value.far) &&
    value.far > value.near
  );
}

function isTimeline(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.durationMs) &&
    isFiniteNumber(value.durationMs) &&
    value.durationMs > 0 &&
    value.durationMs <= 60 * 60 * 1000 &&
    Number.isInteger(value.fps) &&
    isFiniteNumber(value.fps) &&
    value.fps > 0 &&
    value.fps <= 120 &&
    Number.isInteger(value.currentTimeMs) &&
    isFiniteNumber(value.currentTimeMs) &&
    value.currentTimeMs >= 0 &&
    value.currentTimeMs <= value.durationMs &&
    typeof value.playing === "boolean"
  );
}

function isExportProfile(value: unknown): boolean {
  return (
    value === undefined ||
    value === "generic-3d" ||
    value === "transparent-video" ||
    value === "lightfield-quilt" ||
    value === "custom"
  );
}

function isHoloSceneShape(value: unknown): value is HoloScene {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    isNonEmptyString(value.id) &&
    isSource(value.source) &&
    Array.isArray(value.objects) &&
    value.objects.length > 0 &&
    value.objects.every(isHoloObject) &&
    isEnvironment(value.environment) &&
    isCamera(value.camera) &&
    isTimeline(value.timeline) &&
    isExportProfile(value.exportProfile)
  );
}

function restoreSharedRasterSource(scene: HoloScene): HoloScene {
  const sharedSource = scene.source.previewUrl;
  if (!sharedSource) return scene;

  let changed = false;
  const objects = scene.objects.map((object) => {
    if (
      object.geometry.sourceUrl !== undefined ||
      object.geometry.type !== "plane" ||
      (object.creationType !== "holo_logo" &&
        object.creationType !== "holo_graphic")
    ) {
      return object;
    }

    changed = true;
    return {
      ...object,
      geometry: {
        ...object.geometry,
        sourceUrl: sharedSource,
      },
    };
  });

  return changed
    ? {
        ...scene,
        objects,
      }
    : scene;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as UnknownRecord)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function parseHoloSceneJson(text: string): HoloScene {
  if (!text.trim()) {
    throw new Error("HoloScene file is empty.");
  }
  if (text.length > 25 * 1024 * 1024) {
    throw new Error("HoloScene file exceeds the 25 MB import limit.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("HoloScene file is not valid JSON.");
  }

  if (!isHoloSceneShape(parsed)) {
    throw new Error("File does not match the HoloScene v1 structure.");
  }

  const restored = restoreSharedRasterSource(parsed);
  const errors = validateHoloScene(restored);
  if (errors.length) {
    throw new Error("HoloScene validation failed: " + errors.join("; "));
  }

  return deepFreeze(restored);
}

export async function readHoloSceneFile(file: File): Promise<HoloScene> {
  if (file.size <= 0) {
    throw new Error("HoloScene file is empty.");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("HoloScene file exceeds the 25 MB import limit.");
  }

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".json") && !lower.endsWith(".holoscene")) {
    throw new Error("Choose a .json or .holoscene file.");
  }

  return parseHoloSceneJson(await file.text());
}
