import * as THREE from "three";
import { evaluateTrackValue } from "../animation/interpolation";
import type { DepthObject, ObjectTransform } from "../scene/depth-scene";

export function trackValue(
  object: DepthObject,
  property: DepthObject["animationTracks"][number]["property"],
  currentTimeMs: number,
  fallback: number,
): number {
  const track = object.animationTracks.find(
    (candidate) => candidate.property === property,
  );
  if (!track) return fallback;
  return evaluateTrackValue(track, currentTimeMs, fallback);
}

export function sampledTransform(
  object: DepthObject,
  currentTimeMs: number,
): ObjectTransform {
  return {
    position: {
      x: trackValue(
        object,
        "position.x",
        currentTimeMs,
        object.transform.position.x,
      ),
      y: trackValue(
        object,
        "position.y",
        currentTimeMs,
        object.transform.position.y,
      ),
      z: trackValue(
        object,
        "position.z",
        currentTimeMs,
        object.transform.position.z,
      ),
    },
    rotation: {
      x: trackValue(
        object,
        "rotation.x",
        currentTimeMs,
        object.transform.rotation.x,
      ),
      y: trackValue(
        object,
        "rotation.y",
        currentTimeMs,
        object.transform.rotation.y,
      ),
      z: trackValue(
        object,
        "rotation.z",
        currentTimeMs,
        object.transform.rotation.z,
      ),
    },
    scale: {
      x: trackValue(object, "scale.x", currentTimeMs, object.transform.scale.x),
      y: trackValue(object, "scale.y", currentTimeMs, object.transform.scale.y),
      z: trackValue(object, "scale.z", currentTimeMs, object.transform.scale.z),
    },
  };
}

export function objectWorldPosition(
  transform: ObjectTransform,
  aspect: number,
): [number, number, number] {
  return [
    (transform.position.x - 0.5) * (aspect * 4),
    (0.5 - transform.position.y) * 4,
    transform.position.z,
  ];
}

export function worldTransformToDepthTransform(
  group: THREE.Group,
  sceneWidth: number,
  sceneHeight: number,
): ObjectTransform {
  const aspect = sceneWidth / Math.max(1, sceneHeight);
  return {
    position: {
      x: Number((group.position.x / (aspect * 4) + 0.5).toFixed(5)),
      y: Number((0.5 - group.position.y / 4).toFixed(5)),
      z: Number(group.position.z.toFixed(5)),
    },
    rotation: {
      x: Number(THREE.MathUtils.radToDeg(group.rotation.x).toFixed(4)),
      y: Number(THREE.MathUtils.radToDeg(group.rotation.y).toFixed(4)),
      z: Number(THREE.MathUtils.radToDeg(group.rotation.z).toFixed(4)),
    },
    scale: {
      x: Number(group.scale.x.toFixed(5)),
      y: Number(group.scale.y.toFixed(5)),
      z: Number(group.scale.z.toFixed(5)),
    },
  };
}
