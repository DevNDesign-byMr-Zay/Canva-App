export type CreationType =
  | "holo_text"
  | "holo_logo"
  | "holo_graphic"
  | "glass"
  | "chrome"
  | "light_fx";

export type MotionMode = "static" | "shimmer" | "sweep" | "pulse";

export type MaterialFamily =
  | "iridescent"
  | "glass"
  | "foil"
  | "metal"
  | "pearl"
  | "neon"
  | "crystal";

export type HolographicMaterialPreset = {
  id: string;
  name: string;
  description: string;
  family: MaterialFamily;
  parameters: {
    colorShift: number;
    depth: number;
    reflection: number;
    glow: number;
    grain: number;
    angle: number;
    transparency: number;
    motionMode: MotionMode;
  };
};

export const CREATION_TYPES: ReadonlyArray<{
  id: CreationType;
  label: string;
  description: string;
}> = [
  {
    id: "holo_text",
    label: "Holo Text",
    description: "Spectral typography with refraction contours.",
  },
  {
    id: "holo_logo",
    label: "Holo Logo",
    description: "Prismatic brand marks and iridescent emblems.",
  },
  {
    id: "holo_graphic",
    label: "Holo Graphic",
    description: "Volumetric vector accents and spatial graphics.",
  },
  {
    id: "glass",
    label: "Glass",
    description: "Frosted silica dispersion and chromatic refraction.",
  },
  {
    id: "chrome",
    label: "Chrome",
    description: "Specular liquid metal with intense edge highlights.",
  },
  { id: "light_fx", label: "Light FX", description: "Photonic flares, halos, and sweep beams." },
];

export const MATERIAL_PRESETS: ReadonlyArray<HolographicMaterialPreset> = [
  {
    id: "iridescent-chrome",
    name: "Iridescent Chrome",
    description: "Liquid metal mirror with full-spectrum color shift.",
    family: "metal",
    parameters: {
      colorShift: 85,
      depth: 60,
      reflection: 95,
      glow: 40,
      grain: 10,
      angle: 45,
      transparency: 0,
      motionMode: "sweep",
    },
  },
  {
    id: "aurora-glass",
    name: "Aurora Glass",
    description: "Translucent frosted pane with polar light refraction.",
    family: "glass",
    parameters: {
      colorShift: 70,
      depth: 40,
      reflection: 50,
      glow: 65,
      grain: 20,
      angle: 120,
      transparency: 35,
      motionMode: "shimmer",
    },
  },
  {
    id: "prism-foil",
    name: "Prism Foil",
    description: "Micro-embossed rainbow foil stamp.",
    family: "foil",
    parameters: {
      colorShift: 100,
      depth: 20,
      reflection: 80,
      glow: 30,
      grain: 30,
      angle: 90,
      transparency: 0,
      motionMode: "shimmer",
    },
  },
  {
    id: "liquid-metal",
    name: "Liquid Metal",
    description: "Flowing mercury surface with deep reflections.",
    family: "metal",
    parameters: {
      colorShift: 15,
      depth: 75,
      reflection: 90,
      glow: 20,
      grain: 5,
      angle: 180,
      transparency: 0,
      motionMode: "sweep",
    },
  },
  {
    id: "spectral-pearl",
    name: "Spectral Pearl",
    description: "Soft nacre sheen with subtle pastel shift.",
    family: "pearl",
    parameters: {
      colorShift: 45,
      depth: 30,
      reflection: 60,
      glow: 50,
      grain: 15,
      angle: 60,
      transparency: 10,
      motionMode: "shimmer",
    },
  },
  {
    id: "neon-haze",
    name: "Neon Haze",
    description: "High-intensity photonic bloom in cyan-violet.",
    family: "neon",
    parameters: {
      colorShift: 90,
      depth: 50,
      reflection: 30,
      glow: 95,
      grain: 25,
      angle: 270,
      transparency: 15,
      motionMode: "pulse",
    },
  },
  {
    id: "crystal-frost",
    name: "Crystal Frost",
    description: "Geometric crystalline facets with icy edge glint.",
    family: "crystal",
    parameters: {
      colorShift: 30,
      depth: 65,
      reflection: 75,
      glow: 35,
      grain: 40,
      angle: 30,
      transparency: 25,
      motionMode: "static",
    },
  },
  {
    id: "holo-gold",
    name: "Holo Gold",
    description: "Warm gilded finish with holographic dispersion.",
    family: "iridescent",
    parameters: {
      colorShift: 55,
      depth: 50,
      reflection: 85,
      glow: 45,
      grain: 15,
      angle: 135,
      transparency: 0,
      motionMode: "shimmer",
    },
  },
  {
    id: "holo-gunmetal",
    name: "Holo Gunmetal",
    description: "Dark technical titanium with cyan edge diffraction.",
    family: "metal",
    parameters: {
      colorShift: 40,
      depth: 80,
      reflection: 70,
      glow: 25,
      grain: 20,
      angle: 225,
      transparency: 0,
      motionMode: "sweep",
    },
  },
];

export function getPresetById(id: string): HolographicMaterialPreset | undefined {
  return MATERIAL_PRESETS.find((preset) => preset.id === id);
}

export function validateMaterialParameters(
  params: HolographicMaterialPreset["parameters"],
): boolean {
  if (typeof params.colorShift !== "number" || params.colorShift < 0 || params.colorShift > 100)
    return false;
  if (typeof params.depth !== "number" || params.depth < 0 || params.depth > 100) return false;
  if (typeof params.reflection !== "number" || params.reflection < 0 || params.reflection > 100)
    return false;
  if (typeof params.glow !== "number" || params.glow < 0 || params.glow > 100) return false;
  if (typeof params.grain !== "number" || params.grain < 0 || params.grain > 100) return false;
  if (typeof params.angle !== "number" || params.angle < 0 || params.angle > 360) return false;
  if (
    typeof params.transparency !== "number" ||
    params.transparency < 0 ||
    params.transparency > 100
  )
    return false;
  if (!["static", "shimmer", "sweep", "pulse"].includes(params.motionMode)) return false;
  return true;
}
