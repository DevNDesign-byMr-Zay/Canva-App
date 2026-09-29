import { getPresetById } from "./material-contract";
import type { HolographicEffectPlan } from "./effect-plan";
import {
  appElementDataFromPlan,
  type AppOwnedEffectAdapter,
  type HolographicAppElementData,
} from "./app-owned-effect-adapter";
import { getCreationForgeSupport } from "./forge-support";
import { getGeneratedAssetCapability } from "./generated-asset-adapter";

export type HolographicExecutionResult = Readonly<{
  route: "APP_OWNED_EFFECT";
  creationType: HolographicEffectPlan["creationType"];
  presetId: string;
  data: HolographicAppElementData;
  previewOnlyProperties: readonly string[];
}>;

export function previewOnlyProperties(plan: HolographicEffectPlan): readonly string[] {
  return Object.freeze(
    plan.layers.filter((layer) => layer.type === "PREVIEW_ONLY").map((layer) => layer.property),
  );
}

export function canExecuteHolographicPlan(plan: HolographicEffectPlan): boolean {
  if (!plan.isValid) return false;
  const support = getCreationForgeSupport(plan.creationType);
  if (!support.forgeable || support.route !== "APP_OWNED_EFFECT") return false;
  return !plan.layers.some(
    (layer) => layer.type === "GENERATED_ASSET" && !getGeneratedAssetCapability(plan).available,
  );
}

export async function executeHolographicEffectPlan(
  plan: HolographicEffectPlan,
  adapter: AppOwnedEffectAdapter,
): Promise<HolographicExecutionResult> {
  if (!plan.isValid) throw new Error("Holographic effect plan is invalid.");

  const support = getCreationForgeSupport(plan.creationType);
  if (!support.forgeable || support.route !== "APP_OWNED_EFFECT") {
    throw new Error(support.reason);
  }

  if (plan.layers.some((layer) => layer.type === "GENERATED_ASSET")) {
    const generated = getGeneratedAssetCapability(plan);
    if (!generated.available) throw new Error(generated.reason);
  }

  const preset = getPresetById(plan.presetId);
  if (!preset) throw new Error(`Unknown material preset ID: ${plan.presetId}`);

  const data = appElementDataFromPlan(plan, preset.family);
  await adapter.addEffect(data);

  return Object.freeze({
    route: "APP_OWNED_EFFECT" as const,
    creationType: plan.creationType,
    presetId: plan.presetId,
    data,
    previewOnlyProperties: previewOnlyProperties(plan),
  });
}
