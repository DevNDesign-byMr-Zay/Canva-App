import type { DepthScene, DepthObject, AnimationTrack } from "../scene/depth-scene";

export type MotionPresetName =
  | "PARALLAX"
  | "CAMERA_PUSH"
  | "FLOAT"
  | "ORBIT"
  | "DEPTH_REVEAL"
  | "RACK_FOCUS";

export function applyMotionPreset(
  scene: DepthScene,
  preset: MotionPresetName,
): DepthScene {
  const durationMs = scene.timeline.durationMs || 3000;
  const updatedObjects: DepthObject[] = scene.objects.map((obj, idx) => {
    const baseZ = obj.transform.position.z;
    const tracks = [...obj.animationTracks];

    switch (preset) {
      case "PARALLAX": {
        const offset = (idx + 1) * 0.15;
        const posXTrack: AnimationTrack = {
          id: `${obj.id}-track-pos-x`,
          property: "position.x",
          keyframes: [
            {
              timeMs: 0,
              value: obj.transform.position.x - offset,
              easing: "ease-in-out",
            },
            {
              timeMs: durationMs,
              value: obj.transform.position.x + offset,
              easing: "ease-in-out",
            },
          ],
        };
        return {
          ...obj,
          animationTracks: tracks
            .filter((t) => t.property !== "position.x")
            .concat(posXTrack),
        };
      }
      case "FLOAT": {
        const posYTrack: AnimationTrack = {
          id: `${obj.id}-track-pos-y`,
          property: "position.y",
          keyframes: [
            { timeMs: 0, value: obj.transform.position.y, easing: "ease-in-out" },
            {
              timeMs: Math.round(durationMs / 2),
              value: obj.transform.position.y - 0.05,
              easing: "ease-in-out",
            },
            {
              timeMs: durationMs,
              value: obj.transform.position.y,
              easing: "ease-in-out",
            },
          ],
        };
        return {
          ...obj,
          animationTracks: tracks
            .filter((t) => t.property !== "position.y")
            .concat(posYTrack),
        };
      }
      case "DEPTH_REVEAL": {
        const posZTrack: AnimationTrack = {
          id: `${obj.id}-track-pos-z`,
          property: "position.z",
          keyframes: [
            { timeMs: 0, value: baseZ - 0.5, easing: "ease-out" },
            { timeMs: durationMs, value: baseZ, easing: "ease-out" },
          ],
        };
        const opacityTrack: AnimationTrack = {
          id: `${obj.id}-track-opacity`,
          property: "opacity",
          keyframes: [
            { timeMs: 0, value: 0, easing: "ease-out" },
            {
              timeMs: Math.round(durationMs * 0.4),
              value: obj.opacity,
              easing: "ease-out",
            },
          ],
        };
        return {
          ...obj,
          animationTracks: tracks
            .filter(
              (t) => t.property !== "position.z" && t.property !== "opacity",
            )
            .concat(posZTrack, opacityTrack),
        };
      }
      default:
        return obj;
    }
  });

  let updatedCamera = { ...scene.camera };
  if (preset === "CAMERA_PUSH") {
    updatedCamera = {
      ...updatedCamera,
      position: { ...updatedCamera.position, z: updatedCamera.position.z - 2 },
    };
  }

  return {
    ...scene,
    objects: updatedObjects,
    camera: updatedCamera,
  };
}
