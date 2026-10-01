export type DepthPopSettings = Readonly<{
  depthStrength: number;
  depthBlur: number;
  depthFidelity: number;
  steps: number;
}>;

export const DEFAULT_DEPTHPOP_SETTINGS: DepthPopSettings = Object.freeze({
  depthStrength: 0.32,
  depthBlur: 35,
  depthFidelity: 0.95,
  steps: 28,
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// prettier-ignore
export function normalizeDepthPopSettings(
  settings: Partial<DepthPopSettings> = {},
): DepthPopSettings {
  return Object.freeze({
    depthStrength: Number(clamp(settings.depthStrength ?? DEFAULT_DEPTHPOP_SETTINGS.depthStrength, 0.05, 0.75).toFixed(2)),
    depthBlur: Math.round(clamp(settings.depthBlur ?? DEFAULT_DEPTHPOP_SETTINGS.depthBlur, 0, 100)),
    depthFidelity: Number(clamp(settings.depthFidelity ?? DEFAULT_DEPTHPOP_SETTINGS.depthFidelity, 0.05, 1).toFixed(2)),
    steps: Math.round(clamp(settings.steps ?? DEFAULT_DEPTHPOP_SETTINGS.steps, 8, 50)),
  });
}

export type DepthPopFormFields = Readonly<{
  strength: string;
  bokeh: string;
  depth_fidelity: string;
  num_inference_steps: string;
}>;

export function buildDepthPopFormFields(
  settings: DepthPopSettings,
): DepthPopFormFields {
  const normalized = normalizeDepthPopSettings(settings);
  return Object.freeze({
    strength: String(normalized.depthStrength),
    bokeh: String(normalized.depthBlur),
    depth_fidelity: String(normalized.depthFidelity),
    num_inference_steps: String(normalized.steps),
  });
}
