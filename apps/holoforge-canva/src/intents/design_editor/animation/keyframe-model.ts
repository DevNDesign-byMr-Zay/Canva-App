import type {
  HoloAnimationEasing,
  HoloAnimationTrack,
  HoloAnimationProperty,
  HoloKeyframe,
  SceneTransform,
  Vec3,
} from "../scene/holo-scene";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function ease(t: number, easing: HoloAnimationEasing): number {
  const value = clamp01(t);
  switch (easing) {
    case "ease-in":
      return value * value;
    case "ease-out":
      return 1 - (1 - value) * (1 - value);
    case "ease-in-out":
      return value < 0.5
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2;
    default:
      return value;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function interpolateVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return Object.freeze({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  });
}

function sortedKeyframes(keyframes: readonly HoloKeyframe[]): readonly HoloKeyframe[] {
  return Object.freeze([...keyframes].sort((a, b) => a.timeMs - b.timeMs));
}

export function sampleTrack(
  track: HoloAnimationTrack,
  timeMs: number,
): Vec3 | null {
  const keyframes = sortedKeyframes(track.keyframes);
  if (!keyframes.length) return null;
  if (keyframes.length === 1 || timeMs <= keyframes[0]!.timeMs) {
    return keyframes[0]!.value;
  }
  if (timeMs >= keyframes[keyframes.length - 1]!.timeMs) {
    return keyframes[keyframes.length - 1]!.value;
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const left = keyframes[index]!;
    const right = keyframes[index + 1]!;
    if (timeMs < left.timeMs || timeMs > right.timeMs) continue;

    const span = Math.max(1, right.timeMs - left.timeMs);
    const local = (timeMs - left.timeMs) / span;
    return interpolateVec3(left.value, right.value, ease(local, right.easing));
  }

  return keyframes[keyframes.length - 1]!.value;
}

export function sampleTransformTracks(
  tracks: readonly HoloAnimationTrack[],
  timeMs: number,
): Partial<Pick<SceneTransform, "position" | "rotation" | "scale">> {
  const result: Partial<Pick<SceneTransform, "position" | "rotation" | "scale">> = {};
  for (const track of tracks) {
    const sampled = sampleTrack(track, timeMs);
    if (sampled) result[track.property] = sampled;
  }
  return result;
}

function trackId(property: HoloAnimationProperty): string {
  return "track-" + property;
}

function keyframeId(property: HoloAnimationProperty, timeMs: number): string {
  return property + "-" + Math.round(timeMs);
}

export function upsertKeyframe(
  tracks: readonly HoloAnimationTrack[],
  property: HoloAnimationProperty,
  timeMs: number,
  value: Vec3,
  easing: HoloAnimationEasing = "ease-in-out",
): readonly HoloAnimationTrack[] {
  const normalizedTime = Math.max(0, Math.round(timeMs));
  const nextKeyframe: HoloKeyframe = Object.freeze({
    id: keyframeId(property, normalizedTime),
    timeMs: normalizedTime,
    value: Object.freeze({ ...value }),
    easing,
  });

  const existing = tracks.find((track) => track.property === property);
  const nextTrack: HoloAnimationTrack = Object.freeze({
    id: existing?.id ?? trackId(property),
    property,
    keyframes: Object.freeze(
      [
        ...(existing?.keyframes.filter((keyframe) => keyframe.timeMs !== normalizedTime) ?? []),
        nextKeyframe,
      ].sort((a, b) => a.timeMs - b.timeMs),
    ),
  });

  return Object.freeze([
    ...tracks.filter((track) => track.property !== property),
    nextTrack,
  ]);
}

export function upsertTransformPose(
  tracks: readonly HoloAnimationTrack[],
  transform: SceneTransform,
  timeMs: number,
  easing: HoloAnimationEasing = "ease-in-out",
): readonly HoloAnimationTrack[] {
  let next = tracks;
  next = upsertKeyframe(next, "position", timeMs, transform.position, easing);
  next = upsertKeyframe(next, "rotation", timeMs, transform.rotation, easing);
  next = upsertKeyframe(next, "scale", timeMs, transform.scale, easing);
  return Object.freeze(next);
}

export function removePoseAtTime(
  tracks: readonly HoloAnimationTrack[],
  timeMs: number,
  toleranceMs = 18,
): readonly HoloAnimationTrack[] {
  const next = tracks
    .map((track) =>
      Object.freeze({
        ...track,
        keyframes: Object.freeze(
          track.keyframes.filter(
            (keyframe) => Math.abs(keyframe.timeMs - timeMs) > toleranceMs,
          ),
        ),
      }),
    )
    .filter((track) => track.keyframes.length > 0);

  return Object.freeze(next);
}

export function poseTimes(
  tracks: readonly HoloAnimationTrack[],
): readonly number[] {
  const times = new Set<number>();
  for (const track of tracks) {
    for (const keyframe of track.keyframes) times.add(keyframe.timeMs);
  }
  return Object.freeze([...times].sort((a, b) => a - b));
}
