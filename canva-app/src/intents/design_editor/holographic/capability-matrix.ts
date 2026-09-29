export type CapabilityTier =
  | "NATIVE_CANVA_EDIT"
  | "APP_OWNED_EFFECT"
  | "GENERATED_ASSET"
  | "PREVIEW_ONLY";

export type PropertyCapability = {
  property: string;
  tier: CapabilityTier;
  canvaSupported: boolean;
  description: string;
};

export const CANVA_CAPABILITY_MATRIX: ReadonlyRecord<string, PropertyCapability> = {
  x: { property: "x", tier: "NATIVE_CANVA_EDIT", canvaSupported: true, description: "Horizontal element position in Canva absolute layout units." },
  y: { property: "y", tier: "NATIVE_CANVA_EDIT", canvaSupported: true, description: "Vertical element position in Canva absolute layout units." },
  rotation: { property: "rotation", tier: "NATIVE_CANVA_EDIT", canvaSupported: true, description: "Element rotation in degrees around center." },
  width: { property: "width", tier: "PREVIEW_ONLY", canvaSupported: false, description: "Element width previewed spatially; direct mutation not supported via Canva design edit session." },
  height: { property: "height", tier: "PREVIEW_ONLY", canvaSupported: false, description: "Element height previewed spatially; direct mutation not supported via Canva design edit session." },
  depth: { property: "depth", tier: "PREVIEW_ONLY", canvaSupported: false, description: "2.5D spatial scene layer depth for holographic preview only." },
  colorShift: { property: "colorShift", tier: "APP_OWNED_EFFECT", canvaSupported: true, description: "Spectral color distribution persisted in a HoloForge app element." },
  reflection: { property: "reflection", tier: "APP_OWNED_EFFECT", canvaSupported: true, description: "Specular highlight intensity persisted in a HoloForge app element." },
  glow: { property: "glow", tier: "APP_OWNED_EFFECT", canvaSupported: true, description: "Photonic bloom intensity rendered by a HoloForge app element." },
  grain: { property: "grain", tier: "APP_OWNED_EFFECT", canvaSupported: true, description: "Micro-texture density rendered by a HoloForge app element." },
  angle: { property: "angle", tier: "APP_OWNED_EFFECT", canvaSupported: true, description: "Material-light direction persisted in a HoloForge app element." },
  transparency: { property: "transparency", tier: "APP_OWNED_EFFECT", canvaSupported: true, description: "Material opacity rendered by a HoloForge app element." },
  motionMode: { property: "motionMode", tier: "PREVIEW_ONLY", canvaSupported: false, description: "Shimmer, sweep, and pulse are preview semantics; forged app elements are static today." },
  rasterOverlay: { property: "rasterOverlay", tier: "GENERATED_ASSET", canvaSupported: false, description: "High-resolution generated asset layer inserted into design as an element." },
};

type ReadonlyRecord<K extends string, T> = Readonly<Record<K, T>>;

export function getPropertyCapability(property: string): PropertyCapability {
  return CANVA_CAPABILITY_MATRIX[property] ?? {
    property,
    tier: "PREVIEW_ONLY",
    canvaSupported: false,
    description: "Unsupported or unclassified property, restricted to preview only.",
  };
}

export function isNativeCanvaEdit(property: string): boolean {
  return getPropertyCapability(property).tier === "NATIVE_CANVA_EDIT";
}
