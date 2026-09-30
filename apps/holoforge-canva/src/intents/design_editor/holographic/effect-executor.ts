import type { ImageRef } from "@canva/asset";

import { getPresetById } from "./material-contract";
import type { HolographicEffectPlan } from "./effect-plan";
import {
  appElementDataFromPlan,
  type AppOwnedEffectAdapter,
  type HolographicAppElementData,
} from "./app-owned-effect-adapter";
import type { DerivedImageAdapter } from "./derived-image-adapter";
import { getCreationForgeSupport } from "./forge-support";

export type HolographicExecutionRoute = "APP_OWNED_EFFECT" | "DERIVED_IMAGE";

export type HolographicExecutionResult = Readonly<{
  route: HolographicExecutionRoute;
  creationType: HolographicEffectPlan["creationType"];
  presetId: string;
  data?: HolographicAppElementData;
  assetRef?: ImageRef;
  previewOnlyProperties: readonly string[];
}>;

export type HolographicExecutionAdapters = Readonly<{
  appOwned: AppOwnedEffectAdapter;
  derivedImage: DerivedImageAdapter;
}>;

export function previewOnlyProperties(plan: HolographicEffectPlan): readonly string[] {
  return Object.freeze(
    plan.layers.filter((layer) => layer.type === "PREVIEW_ONLY").map((layer) => layer.property),
  );
}

export function resolveExecutionRoute(plan: HolographicEffectPlan): HolographicExecutionRoute {
  if (plan.creationType === "holo_logo") return "DERIVED_IMAGE";
  if (plan.creationType === "holo_graphic" && plan.sourceImageRef) return "DERIVED_IMAGE";
  return "APP_OWNED_EFFECT";
}

function hasRequiredSource(plan: HolographicEffectPlan): boolean {
  const support = getCreationForgeSupport(plan.creationType);
  if (support.requiredSource === "image") return Boolean(plan.sourceImageRef);
  if (support.requiredSource === "text") return Boolean(plan.sourceText?.trim());
  return true;
}

export function canExecuteHolographicPlan(plan: HolographicEffectPlan): boolean {
  if (!plan.isValid || !hasRequiredSource(plan)) return false;
  return getCreationForgeSupport(plan.creationType).forgeable;
}

export async function executeHolographicEffectPlan(
  plan: HolographicEffectPlan,
  adapters: HolographicExecutionAdapters,
): Promise<HolographicExecutionResult> {
  if (!plan.isValid) throw new Error("Holographic effect plan is invalid.");

  const support = getCreationForgeSupport(plan.creationType);
  if (support.requiredSource === "image" && !plan.sourceImageRef) {
    throw new Error("Choose or upload a raster image before forging this holographic logo.");
  }
  if (support.requiredSource === "text" && !plan.sourceText?.trim()) {
    throw new Error("Enter text before forging a holographic text element.");
  }

  const preset = getPresetById(plan.presetId);
  if (!preset) throw new Error(`Unknown material preset ID: ${plan.presetId}`);

  const route = resolveExecutionRoute(plan);
  const previewOnly = previewOnlyProperties(plan);

  if (route === "DERIVED_IMAGE") {
    const derived = await adapters.derivedImage.addDerivedEffect(plan);
    return Object.freeze({
      route,
      creationType: plan.creationType,
      presetId: plan.presetId,
      assetRef: derived.ref,
      previewOnlyProperties: previewOnly,
    });
  }

  const data = appElementDataFromPlan(plan, preset.family);
  await adapters.appOwned.addEffect(data);

  return Object.freeze({
    route,
    creationType: plan.creationType,
    presetId: plan.presetId,
    data,
    previewOnlyProperties: previewOnly,
  });
}
