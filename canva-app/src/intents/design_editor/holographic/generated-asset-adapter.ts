import type { HolographicEffectPlan } from "./effect-plan";

export type GeneratedAssetCapability = Readonly<{
  available: false;
  reason: string;
}>;

export function getGeneratedAssetCapability(
  _plan: HolographicEffectPlan,
): GeneratedAssetCapability {
  return Object.freeze({
    available: false,
    reason:
      "No authenticated generated-asset provider is configured. HoloForge will not pretend this route is available.",
  });
}
