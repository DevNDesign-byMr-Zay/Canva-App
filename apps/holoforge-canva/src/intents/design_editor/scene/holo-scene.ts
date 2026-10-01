import type { HolographicEffectPlan } from "../holographic/effect-plan";
import {
  getPresetById,
  type CreationType,
  type MaterialFamily,
  type MotionMode,
} from "../holographic/material-contract";

export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type Euler3 = Readonly<{ x: number; y: number; z: number }>;

export type SceneTransform = Readonly<{
  position: Vec3;
  rotation: Euler3;
  scale: Vec3;
}>;

export type HoloSourceType = "raster" | "vector" | "text" | "canva" | "generated";
export type HoloGeometryType = "extruded-shape" | "plane" | "text" | "mesh";

export type HoloMaterialSpec = Readonly<{
  family: MaterialFamily;
  baseColor: string;
  opacity: number;
  metalness: number;
  roughness: number;
  transmission: number;
  ior: number;
  emissionColor: string;
  emissionStrength: number;
  spectralShift: number;
  diffraction: number;
  scanlineStrength: number;
  shimmerStrength: number;
  reflectionStrength: number;
}>;

export type HoloGeometrySpec = Readonly<{
  type: HoloGeometryType;
  sourceUrl?: string;
  thickness: number;
  bevelSize: number;
  bevelSegments: number;
  meshUrl?: string;
}>;

export type HoloAnimationPreset =
  | "static"
  | "turntable"
  | "shimmer"
  | "sweep"
  | "pulse"
  | "orbit"
  | "custom";

export type HoloAnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type HoloAnimationProperty = "position" | "rotation" | "scale";

export type HoloKeyframe = Readonly<{
  id: string;
  timeMs: number;
  value: Vec3;
  easing: HoloAnimationEasing;
}>;

export type HoloAnimationTrack = Readonly<{
  id: string;
  property: HoloAnimationProperty;
  keyframes: readonly HoloKeyframe[];
}>;

export type HoloObject = Readonly<{
  id: string;
  name: string;
  creationType: CreationType;
  geometry: HoloGeometrySpec;
  material: HoloMaterialSpec;
  transform: SceneTransform;
  animationPreset: HoloAnimationPreset;
  animationTracks: readonly HoloAnimationTrack[];
  sourceText?: string;
  visible: boolean;
}>;

export type HoloEnvironment = Readonly<{
  background: string;
  ambientIntensity: number;
  keyLightIntensity: number;
  rimLightIntensity: number;
  floorGrid: boolean;
}>;

export type HoloCamera = Readonly<{
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
}>;

export type HoloTimeline = Readonly<{
  durationMs: number;
  fps: number;
  currentTimeMs: number;
  playing: boolean;
}>;

export type HoloScene = Readonly<{
  schemaVersion: 1;
  id: string;
  source: Readonly<{
    type: HoloSourceType;
    assetId?: string;
    previewUrl?: string;
    text?: string;
  }>;
  objects: readonly HoloObject[];
  environment: HoloEnvironment;
  camera: HoloCamera;
  timeline: HoloTimeline;
  exportProfile?: "generic-3d" | "transparent-video" | "lightfield-quilt" | "custom";
}>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function spectralColor(shift: number): string {
  const hue = Math.round(180 + (Math.max(0, Math.min(100, shift)) / 100) * 150);
  return `hsl(${hue} 88% 66%)`;
}

function motionToAnimation(mode: MotionMode): HoloAnimationPreset {
  switch (mode) {
    case "shimmer":
      return "shimmer";
    case "sweep":
      return "sweep";
    case "pulse":
      return "pulse";
    default:
      return "static";
  }
}

function sourceTypeForPlan(plan: HolographicEffectPlan): HoloSourceType {
  if (plan.creationType === "holo_text") return "text";
  if (plan.sourceImageRef) {
    return plan.sourceKind === "selected" ? "canva" : "raster";
  }
  return "generated";
}

function geometryForPlan(
  plan: HolographicEffectPlan,
  sourcePreviewUrl?: string | null,
): HoloGeometrySpec {
  const normalizedDepth = clamp01(plan.parameters.depth / 100);
  const thickness = Number((0.04 + normalizedDepth * 0.34).toFixed(3));
  const bevelSize = Number((0.006 + normalizedDepth * 0.035).toFixed(3));

  if (plan.creationType === "holo_text") {
    return Object.freeze({
      type: "text",
      thickness,
      bevelSize,
      bevelSegments: 3,
    });
  }

  if (
    (plan.creationType === "holo_logo" || plan.creationType === "holo_graphic") &&
    sourcePreviewUrl
  ) {
    return Object.freeze({
      type: "plane",
      sourceUrl: sourcePreviewUrl,
      thickness,
      bevelSize,
      bevelSegments: 2,
    });
  }

  if (plan.creationType === "glass" || plan.creationType === "chrome") {
    return Object.freeze({
      type: "extruded-shape",
      thickness,
      bevelSize,
      bevelSegments: 4,
    });
  }

  return Object.freeze({
    type: "plane",
    thickness,
    bevelSize,
    bevelSegments: 2,
  });
}

export function materialFromPlan(
  plan: HolographicEffectPlan,
  family: MaterialFamily,
): HoloMaterialSpec {
  const p = plan.parameters;
  const transparency = clamp01(p.transparency / 100);
  const reflection = clamp01(p.reflection / 100);
  const glow = clamp01(p.glow / 100);
  const grain = clamp01(p.grain / 100);
  const glassLike = family === "glass" || family === "crystal";
  const metalLike = family === "metal" || family === "foil";

  return Object.freeze({
    family,
    baseColor: spectralColor(p.colorShift),
    opacity: Number((1 - transparency).toFixed(3)),
    metalness: Number((metalLike ? 0.58 + reflection * 0.4 : reflection * 0.26).toFixed(3)),
    roughness: Number((Math.max(0.05, 0.72 - reflection * 0.58 + grain * 0.14)).toFixed(3)),
    transmission: Number((glassLike ? Math.max(0.28, transparency * 0.9 + 0.25) : 0).toFixed(3)),
    ior: Number((glassLike ? 1.28 + reflection * 0.32 : 1.1).toFixed(3)),
    emissionColor: spectralColor((p.colorShift + 18) % 100),
    emissionStrength: Number((0.04 + glow * 1.45).toFixed(3)),
    spectralShift: p.colorShift,
    diffraction: Number((0.12 + grain * 0.72).toFixed(3)),
    scanlineStrength: Number((plan.parameters.motionMode === "sweep" ? 0.82 : 0.28).toFixed(3)),
    shimmerStrength: Number((plan.parameters.motionMode === "shimmer" ? 0.9 : 0.2).toFixed(3)),
    reflectionStrength: p.reflection,
  });
}

function defaultTransform(plan: HolographicEffectPlan): SceneTransform {
  const angleRad = (plan.parameters.angle * Math.PI) / 180;
  return Object.freeze({
    position: Object.freeze({ x: 0, y: 0, z: 0 }),
    rotation: Object.freeze({
      x: Number((-0.08 + Math.sin(angleRad) * 0.08).toFixed(4)),
      y: Number((Math.cos(angleRad) * 0.12).toFixed(4)),
      z: 0,
    }),
    scale: Object.freeze({ x: 1, y: 1, z: 1 }),
  });
}

function familyForPlan(plan: HolographicEffectPlan): MaterialFamily {
  return getPresetById(plan.presetId)?.family ?? "metal";
}

export function createHoloScene(
  plan: HolographicEffectPlan,
  sourcePreviewUrl?: string | null,
): HoloScene {
  const family = familyForPlan(plan);
  const sourceType = sourceTypeForPlan(plan);
  const objectId = `hf-object-${plan.creationType}`;
  const sourceAssetId = plan.sourceImageRef ? String(plan.sourceImageRef) : undefined;

  return Object.freeze({
    schemaVersion: 1 as const,
    id: `hf-scene-${plan.creationType}-${plan.presetId}`,
    source: Object.freeze({
      type: sourceType,
      assetId: sourceAssetId,
      previewUrl: sourcePreviewUrl ?? undefined,
      text: plan.sourceText,
    }),
    objects: Object.freeze([
      Object.freeze({
        id: objectId,
        name:
          plan.creationType === "holo_text"
            ? plan.sourceText || "HOLOFORGE"
            : plan.creationType.replaceAll("_", " ").toUpperCase(),
        creationType: plan.creationType,
        geometry: geometryForPlan(plan, sourcePreviewUrl),
        material: materialFromPlan(plan, family),
        transform: defaultTransform(plan),
        animationPreset: motionToAnimation(plan.parameters.motionMode),
        animationTracks: Object.freeze([]),
        sourceText: plan.sourceText,
        visible: true,
      }),
    ]),
    environment: Object.freeze({
      background: "#020307",
      ambientIntensity: 0.68,
      keyLightIntensity: 2.15,
      rimLightIntensity: 1.65,
      floorGrid: true,
    }),
    camera: Object.freeze({
      position: Object.freeze({ x: 0, y: 0.35, z: 4.3 }),
      target: Object.freeze({ x: 0, y: 0, z: 0 }),
      fov: 42,
      near: 0.05,
      far: 100,
    }),
    timeline: Object.freeze({
      durationMs: 6000,
      fps: 30,
      currentTimeMs: 0,
      playing: plan.parameters.motionMode !== "static",
    }),
    exportProfile: "generic-3d",
  });
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function finiteVec3(value: Vec3): boolean {
  return (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

export function validateHoloScene(scene: HoloScene): readonly string[] {
  const errors: string[] = [];
  if (scene.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!scene.id.trim()) errors.push("scene id is required");
  if (!scene.objects.length) errors.push("scene requires at least one object");
  if (scene.objects.length > 128) errors.push("scene supports at most 128 objects");

  const ids = new Set<string>();
  for (const object of scene.objects) {
    if (!object.id.trim()) errors.push("object id is required");
    if (ids.has(object.id)) errors.push(`duplicate object id: ${object.id}`);
    ids.add(object.id);
    if (!object.name.trim()) errors.push(`object ${object.id} requires a name`);

    if (
      !finiteVec3(object.transform.position) ||
      !finiteVec3(object.transform.rotation) ||
      !finiteVec3(object.transform.scale)
    ) {
      errors.push(`object ${object.id} transform must contain finite values`);
    }
    if (
      object.transform.scale.x <= 0 ||
      object.transform.scale.y <= 0 ||
      object.transform.scale.z <= 0
    ) {
      errors.push(`object ${object.id} scale components must be positive`);
    }

    const material = object.material;
    const normalizedMaterialFields: ReadonlyArray<
      readonly [string, number, number, number]
    > = [
      ["opacity", material.opacity, 0, 1],
      ["metalness", material.metalness, 0, 1],
      ["roughness", material.roughness, 0, 1],
      ["transmission", material.transmission, 0, 1],
      ["ior", material.ior, Number.EPSILON, 5],
      ["emissionStrength", material.emissionStrength, 0, 20],
      ["spectralShift", material.spectralShift, 0, 100],
      ["diffraction", material.diffraction, 0, 2],
      ["scanlineStrength", material.scanlineStrength, 0, 2],
      ["shimmerStrength", material.shimmerStrength, 0, 2],
      ["reflectionStrength", material.reflectionStrength, 0, 100],
    ];
    for (const [field, value, min, max] of normalizedMaterialFields) {
      if (!inRange(value, min, max)) {
        errors.push(
          `object ${object.id} material ${field} must be between ${min} and ${max}`,
        );
      }
    }

    if (!inRange(object.geometry.thickness, 0, 20)) {
      errors.push(`object ${object.id} thickness must be between 0 and 20`);
    }
    if (!inRange(object.geometry.bevelSize, 0, 10)) {
      errors.push(`object ${object.id} bevel size must be between 0 and 10`);
    }
    if (
      !Number.isInteger(object.geometry.bevelSegments) ||
      !inRange(object.geometry.bevelSegments, 0, 32)
    ) {
      errors.push(`object ${object.id} bevel segments must be an integer from 0 to 32`);
    }

    for (const track of object.animationTracks) {
      if (!track.id.trim()) {
        errors.push(`object ${object.id} animation track id is required`);
      }
      let previousTime = -1;
      const keyframeTimes = new Set<number>();
      for (const keyframe of track.keyframes) {
        if (!keyframe.id.trim()) {
          errors.push(`object ${object.id} keyframe id is required`);
        }
        if (!finiteVec3(keyframe.value)) {
          errors.push(`object ${object.id} keyframe ${keyframe.id} value must be finite`);
        }
        if (keyframe.timeMs < 0 || keyframe.timeMs > scene.timeline.durationMs) {
          errors.push(`object ${object.id} keyframe ${keyframe.id} is outside the timeline`);
        }
        if (keyframe.timeMs < previousTime) {
          errors.push(`object ${object.id} keyframes must be time-sorted`);
        }
        if (keyframeTimes.has(keyframe.timeMs)) {
          errors.push(`object ${object.id} keyframe times must be unique within a track`);
        }
        keyframeTimes.add(keyframe.timeMs);
        previousTime = keyframe.timeMs;
      }
    }
  }

  if (!finiteVec3(scene.camera.position) || !finiteVec3(scene.camera.target)) {
    errors.push("camera vectors must contain finite values");
  }
  if (!inRange(scene.camera.fov, Number.EPSILON, 179.999)) {
    errors.push("camera fov is invalid");
  }
  if (!Number.isFinite(scene.camera.near) || scene.camera.near <= 0) {
    errors.push("camera near plane must be positive");
  }
  if (!Number.isFinite(scene.camera.far) || scene.camera.far <= scene.camera.near) {
    errors.push("camera far plane must be greater than near");
  }

  if (!inRange(scene.environment.ambientIntensity, 0, 20)) {
    errors.push("ambient intensity must be between 0 and 20");
  }
  if (!inRange(scene.environment.keyLightIntensity, 0, 20)) {
    errors.push("key light intensity must be between 0 and 20");
  }
  if (!inRange(scene.environment.rimLightIntensity, 0, 20)) {
    errors.push("rim light intensity must be between 0 and 20");
  }

  if (
    !Number.isInteger(scene.timeline.durationMs) ||
    scene.timeline.durationMs <= 0 ||
    scene.timeline.durationMs > 60 * 60 * 1000
  ) {
    errors.push("timeline duration must be an integer from 1 ms to 1 hour");
  }
  if (
    !Number.isInteger(scene.timeline.fps) ||
    scene.timeline.fps <= 0 ||
    scene.timeline.fps > 120
  ) {
    errors.push("timeline fps must be an integer from 1 to 120");
  }
  if (
    !Number.isInteger(scene.timeline.currentTimeMs) ||
    scene.timeline.currentTimeMs < 0 ||
    scene.timeline.currentTimeMs > scene.timeline.durationMs
  ) {
    errors.push("timeline current time must lie within the scene duration");
  }

  return Object.freeze(errors);
}
