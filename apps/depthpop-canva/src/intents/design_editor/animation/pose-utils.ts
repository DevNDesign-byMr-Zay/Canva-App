import { evaluateTrackValue } from "./interpolation";
import type { AnimationEasing, AnimationProperty, AnimationTrack, DepthObject } from "../scene/depth-scene";

const ANIMATION_PROPERTIES: AnimationProperty[] = [
  "position.x",
  "position.y",
  "position.z",
  "rotation.x",
  "rotation.y",
  "rotation.z",
  "scale.x",
  "scale.y",
  "scale.z",
  "opacity",
];


export function animationValue(
  object: DepthObject,
  property: AnimationProperty,
): number {
  switch (property) {
    case "position.x":
      return object.transform.position.x;
    case "position.y":
      return object.transform.position.y;
    case "position.z":
      return object.transform.position.z;
    case "rotation.x":
      return object.transform.rotation.x;
    case "rotation.y":
      return object.transform.rotation.y;
    case "rotation.z":
      return object.transform.rotation.z;
    case "scale.x":
      return object.transform.scale.x;
    case "scale.y":
      return object.transform.scale.y;
    case "scale.z":
      return object.transform.scale.z;
    case "opacity":
      return object.opacity;
  }
}

export function sampledAnimationValue(
  object: DepthObject,
  property: AnimationProperty,
  timeMs: number,
): number {
  const fallback = animationValue(object, property);
  const track = object.animationTracks.find(
    (candidate) => candidate.property === property,
  );
  return track
    ? evaluateTrackValue(track, timeMs, fallback)
    : fallback;
}

export function upsertPose(
  object: DepthObject,
  timeMs: number,
  easing: AnimationEasing,
  values?: Partial<Record<AnimationProperty, number>>,
): AnimationTrack[] {
  return ANIMATION_PROPERTIES.map((property) => {
    const existing = object.animationTracks.find(
      (track) => track.property === property,
    );
    const value =
      values?.[property] ??
      sampledAnimationValue(object, property, timeMs);
    let keyframes = existing ? [...existing.keyframes] : [];

    if (!existing && timeMs > 0) {
      keyframes.push({
        timeMs: 0,
        value: animationValue(object, property),
        easing: "linear",
      });
    }

    const index = keyframes.findIndex(
      (keyframe) => keyframe.timeMs === timeMs,
    );
    const nextKeyframe = { timeMs, value, easing };
    if (index >= 0) {
      keyframes[index] = nextKeyframe;
    } else {
      keyframes.push(nextKeyframe);
    }
    keyframes.sort((left, right) => left.timeMs - right.timeMs);

    return {
      id: existing?.id ?? `${object.id}-track-${property.replace(".", "-")}`,
      property,
      keyframes,
    };
  });
}

export function removePose(
  tracks: AnimationTrack[],
  timeMs: number,
): AnimationTrack[] {
  return tracks
    .map((track) => ({
      ...track,
      keyframes: track.keyframes.filter(
        (keyframe) => keyframe.timeMs !== timeMs,
      ),
    }))
    .filter((track) => track.keyframes.length > 0);
}

export function poseTimes(object: DepthObject): number[] {
  return [
    ...new Set(
      object.animationTracks.flatMap((track) =>
        track.keyframes.map((keyframe) => keyframe.timeMs),
      ),
    ),
  ].sort((left, right) => left - right);
}
