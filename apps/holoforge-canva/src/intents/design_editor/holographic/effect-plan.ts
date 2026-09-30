import type { ImageRef } from "@canva/asset";
import { getPropertyCapability, type CapabilityTier } from "./capability-matrix";
import {
  getPresetById,
  validateMaterialParameters,
  type CreationType,
  type HolographicMaterialPreset,
} from "./material-contract";

export type EffectPlanLayer = {
  id: string;
  type: CapabilityTier;
  property: string;
  value: number | string;
  canvaSupported: boolean;
};

export type HolographicEffectPlan = {
  version: 1;
  creationType: CreationType;
  presetId: string;
  presetName: string;
  targetElementId?: string;
  sourceImageRef?: ImageRef;
  sourceKind?: "selected" | "uploaded";
  sourceText?: string;
  parameters: HolographicMaterialPreset["parameters"];
  layers: EffectPlanLayer[];
  nativeTransform?: { x?: number; y?: number; rotation?: number };
  isValid: boolean;
};

export function createEffectPlan(options: {
  creationType: CreationType;
  presetId: string;
  customParameters?: Partial<HolographicMaterialPreset["parameters"]>;
  targetElementId?: string;
  sourceImageRef?: ImageRef;
  sourceKind?: "selected" | "uploaded";
  sourceText?: string;
  nativeTransform?: { x?: number; y?: number; rotation?: number };
}): HolographicEffectPlan {
  const preset = getPresetById(options.presetId);
  if (!preset) throw new Error(`Unknown material preset ID: ${options.presetId}`);

  const parameters: HolographicMaterialPreset["parameters"] = {
    ...preset.parameters,
    ...options.customParameters,
  };
  const valid = validateMaterialParameters(parameters);
  const layers: EffectPlanLayer[] = [];

  for (const [key, val] of Object.entries(parameters)) {
    const cap = getPropertyCapability(key);
    layers.push({
      id: `layer-${key}`,
      type: cap.tier,
      property: key,
      value: val,
      canvaSupported: cap.canvaSupported,
    });
  }

  if (options.nativeTransform) {
    for (const [key, val] of Object.entries(options.nativeTransform)) {
      if (val === undefined) continue;
      const cap = getPropertyCapability(key);
      layers.push({
        id: `layer-native-${key}`,
        type: cap.tier,
        property: key,
        value: val,
        canvaSupported: cap.canvaSupported,
      });
    }
  }

  return {
    version: 1,
    creationType: options.creationType,
    presetId: preset.id,
    presetName: preset.name,
    targetElementId: options.targetElementId,
    sourceImageRef: options.sourceImageRef,
    sourceKind: options.sourceKind,
    sourceText: options.sourceText?.trim().slice(0, 96),
    parameters,
    layers,
    nativeTransform: options.nativeTransform,
    isValid: valid,
  };
}
