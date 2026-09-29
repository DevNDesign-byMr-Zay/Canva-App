export type DepthPopQuality = "fast" | "balanced" | "max";

export type DepthPopSettings = Readonly<{
  depth: number;
  bokeh: number;
  focus: number;
  edgeLift: number;
  quality: DepthPopQuality;
}>;

export type DepthPopPreviewModel = Readonly<{
  foregroundScale: number;
  subjectScale: number;
  backgroundScale: number;
  backgroundBlurPx: number;
  subjectLiftPx: number;
  glowOpacity: number;
  focusPositionPercent: number;
}>;

export const DEFAULT_DEPTHPOP_SETTINGS: DepthPopSettings = Object.freeze({
  depth: 62,
  bokeh: 38,
  focus: 42,
  edgeLift: 28,
  quality: "balanced",
});

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function normalizeDepthPopSettings(
  settings: Partial<DepthPopSettings> = {},
): DepthPopSettings {
  const quality: DepthPopQuality = ["fast", "balanced", "max"].includes(settings.quality ?? "")
    ? (settings.quality as DepthPopQuality)
    : DEFAULT_DEPTHPOP_SETTINGS.quality;

  return Object.freeze({
    depth: clamp(settings.depth ?? DEFAULT_DEPTHPOP_SETTINGS.depth),
    bokeh: clamp(settings.bokeh ?? DEFAULT_DEPTHPOP_SETTINGS.bokeh),
    focus: clamp(settings.focus ?? DEFAULT_DEPTHPOP_SETTINGS.focus),
    edgeLift: clamp(settings.edgeLift ?? DEFAULT_DEPTHPOP_SETTINGS.edgeLift),
    quality,
  });
}

export function buildDepthPopPreviewModel(settings: DepthPopSettings): DepthPopPreviewModel {
  const normalized = normalizeDepthPopSettings(settings);
  const depthRatio = normalized.depth / 100;
  const bokehRatio = normalized.bokeh / 100;
  const edgeRatio = normalized.edgeLift / 100;

  return Object.freeze({
    foregroundScale: Number((1.03 + depthRatio * 0.1).toFixed(3)),
    subjectScale: Number((1 + depthRatio * 0.055).toFixed(3)),
    backgroundScale: Number((0.985 - depthRatio * 0.025).toFixed(3)),
    backgroundBlurPx: Number((1.5 + bokehRatio * 10.5).toFixed(2)),
    subjectLiftPx: Number((3 + depthRatio * 14).toFixed(2)),
    glowOpacity: Number((0.08 + edgeRatio * 0.34).toFixed(3)),
    focusPositionPercent: normalized.focus,
  });
}

export function getDepthPopExecutionCapability(): Readonly<{
  available: false;
  reason: string;
}> {
  return Object.freeze({
    available: false,
    reason:
      "DepthPop processing stays preview-only until an authenticated image-effect provider is configured for the Canva app.",
  });
}
