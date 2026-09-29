export type DepthPopQuality = "fast" | "balanced" | "cinematic";

export type DepthPopSettings = Readonly<{
  depthStrength: number;
  depthBlur: number;
  depthFidelity: number;
  quality: DepthPopQuality;
}>;

export const DEPTHPOP_QUALITY_STEPS: Readonly<Record<DepthPopQuality, number>> = Object.freeze({
  fast: 14,
  balanced: 22,
  cinematic: 34,
});

/**
 * Parity contract taken from the maintained ROARY v115 DepthPop panel in Drive.
 * The visible controls intentionally keep the same ranges and defaults instead
 * of inventing a separate Canva-specific effect vocabulary.
 */
export const DEFAULT_DEPTHPOP_SETTINGS: DepthPopSettings = Object.freeze({
  depthStrength: 0.32,
  depthBlur: 35,
  depthFidelity: 0.95,
  quality: "cinematic",
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function normalizeDepthPopSettings(
  settings: Partial<DepthPopSettings> = {},
): DepthPopSettings {
  const quality: DepthPopQuality = ["fast", "balanced", "cinematic"].includes(
    settings.quality ?? "",
  )
    ? (settings.quality as DepthPopQuality)
    : DEFAULT_DEPTHPOP_SETTINGS.quality;

  return Object.freeze({
    depthStrength: Number(
      clamp(settings.depthStrength ?? DEFAULT_DEPTHPOP_SETTINGS.depthStrength, 0.05, 0.75).toFixed(
        2,
      ),
    ),
    depthBlur: Math.round(clamp(settings.depthBlur ?? DEFAULT_DEPTHPOP_SETTINGS.depthBlur, 0, 100)),
    depthFidelity: Number(
      clamp(settings.depthFidelity ?? DEFAULT_DEPTHPOP_SETTINGS.depthFidelity, 0.05, 1).toFixed(2),
    ),
    quality,
  });
}

export function getDepthPopInferenceSteps(quality: DepthPopQuality): number {
  return DEPTHPOP_QUALITY_STEPS[quality];
}

export type DepthPopExecutionParameters = Readonly<{
  strength: number;
  bokehPercent: number;
  depthFidelity: number;
  numInferenceSteps: number;
}>;

export function buildDepthPopExecutionParameters(
  settings: DepthPopSettings,
): DepthPopExecutionParameters {
  const normalized = normalizeDepthPopSettings(settings);
  return Object.freeze({
    strength: normalized.depthStrength,
    bokehPercent: normalized.depthBlur,
    depthFidelity: normalized.depthFidelity,
    numInferenceSteps: getDepthPopInferenceSteps(normalized.quality),
  });
}

export function getDepthPopExecutionCapability(): Readonly<{
  available: false;
  reason: string;
}> {
  return Object.freeze({
    available: false,
    reason:
      "DepthPop matches the maintained ROARY control contract, but Canva execution stays locked until an authenticated image-effect provider is configured.",
  });
}
