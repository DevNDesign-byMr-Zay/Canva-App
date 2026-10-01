import type { HolographicEffectPlan } from "../holographic/effect-plan";
import type {
  CreationType,
  MaterialFamily,
  MotionMode,
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

export type HoloObject = Readonly<{
  id: string;
  name: string;
  creationType: CreationType;
  geometry: HoloGeometrySpec;
  material: HoloMaterialSpec;
  transform: SceneTransform;
  animationPreset: HoloAnimationPreset;
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
  const familyLayer = plan.layers.find((layer) => layer.property === "family");
  if (typeof familyLayer?.value === "string") {
    return familyLayer.value as MaterialFamily;
  }

  switch (plan.presetId) {
    case "aurora-glass":
      return "glass";
    case "prism-foil":
      return "foil";
    case "spectral-pearl":
      return "pearl";
    case "neon-haze":
      return "neon";
    case "crystal-frost":
      return "crystal";
    case "holo-gold":
      return "iridescent";
    default:
      return "metal";
  }
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

export function validateHoloScene(scene: HoloScene): readonly string[] {
  const errors: string[] = [];
  if (scene.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!scene.id.trim()) errors.push("scene id is required");
  if (!scene.objects.length) errors.push("scene requires at least one object");

  const ids = new Set<string>();
  for (const object of scene.objects) {
    if (!object.id.trim()) errors.push("object id is required");
    if (ids.has(object.id)) errors.push(`duplicate object id: ${object.id}`);
    ids.add(object.id);
    if (!object.name.trim()) errors.push(`object ${object.id} requires a name`);
    if (object.material.opacity < 0 || object.material.opacity > 1) {
      errors.push(`object ${object.id} opacity must be normalized`);
    }
    if (object.geometry.thickness < 0) {
      errors.push(`object ${object.id} thickness must be non-negative`);
    }
  }

  if (scene.camera.fov <= 0 || scene.camera.fov >= 180) errors.push("camera fov is invalid");
  if (scene.timeline.durationMs <= 0) errors.push("timeline duration must be positive");
  if (scene.timeline.fps <= 0) errors.push("timeline fps must be positive");
  return Object.freeze(errors);
}
