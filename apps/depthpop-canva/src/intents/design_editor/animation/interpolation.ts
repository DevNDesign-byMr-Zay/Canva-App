import type { AnimationKeyframe, AnimationTrack } from "../scene/depth-scene";

export function evaluateEasing(
  progress: number,
  easing: AnimationKeyframe["easing"] = "linear",
): number {
  const t = Math.max(0, Math.min(1, progress));
  switch (easing) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return t * (2 - t);
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case "linear":
    default:
      return t;
  }
}

export function evaluateTrackValue(
  track: AnimationTrack,
  timeMs: number,
  defaultValue: number,
): number {
  if (!track.keyframes || track.keyframes.length === 0) {
    return defaultValue;
  }

  const sorted = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);

  if (timeMs <= sorted[0].timeMs) {
    return sorted[0].value;
  }

  const lastKeyframe = sorted[sorted.length - 1];
  if (timeMs >= lastKeyframe.timeMs) {
    return lastKeyframe.value;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i + 1];
    if (timeMs >= k1.timeMs && timeMs <= k2.timeMs) {
      const duration = k2.timeMs - k1.timeMs;
      if (duration <= 0) return k1.value;
      const rawProgress = (timeMs - k1.timeMs) / duration;
      const easedProgress = evaluateEasing(rawProgress, k2.easing ?? "linear");
      return k1.value + easedProgress * (k2.value - k1.value);
    }
  }

  return defaultValue;
}
