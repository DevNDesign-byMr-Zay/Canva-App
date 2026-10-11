import type { DepthScene, DepthSceneObject } from "../scene/depth-scene";

export type MotionPresetName =
  | "PARALLAX"
  | "CAMERA_PUSH"
  | "FLOAT"
  | "ORBIT"
  | "DEPTH_REVEAL"
  | "RACK_FOCUS";

export function applyMotionPreset(scene: DepthScene, preset: MotionPresetName): DepthScene {
  const durationMs = scene.timeline.durationMs || 3000;
  const updatedObjects: DepthSceneObject[] = scene.objects.map((obj, idx) => {
    const baseZ = obj.transform.position.z;
    const tracks = [...obj.animationTracks];

    switch (preset) {
      case "PARALLAX": {
        const offset = (idx + 1) * 0.15;
        const posXTrack = tracks.find((t) => t.property === "position.x") || {
          property: "position.x",
          keyframes: [],
        };
        posXTrack.keyframes = [
          { id: `${obj.id}-p-0`, timeMs: 0, value: obj.transform.position.x - offset, easing: "ease-in-out" },
          { id: `${obj.id}-p-1`, timeMs: durationMs, value: obj.transform.position.x + offset, easing: "ease-in-out" },
        ];
        return {
          ...obj,
          animationTracks: tracks.filter((t) => t.property !== "position.x").concat(posXTrack),
        };
      }
      case "FLOAT": {
        const posYTrack = tracks.find((t) => t.property === "position.y") || {
          property: "position.y",
          keyframes: [],
        };
        posYTrack.keyframes = [
          { id: `${obj.id}-f-0`, timeMs: 0, value: obj.transform.position.y, easing: "ease-in-out" },
          { id: `${obj.id}-f-1`, timeMs: durationMs / 2, value: obj.transform.position.y - 0.05, easing: "ease-in-out" },
          { id: `${obj.id}-f-2`, timeMs: durationMs, value: obj.transform.position.y, easing: "ease-in-out" },
        ];
        return {
          ...obj,
          animationTracks: tracks.filter((t) => t.property !== "position.y").concat(posYTrack),
        };
      }
      case "DEPTH_REVEAL": {
        const posZTrack = tracks.find((t) => t.property === "position.z") || {
          property: "position.z",
          keyframes: [],
        };
        const opacityTrack = tracks.find((t) => t.property === "opacity") || {
          property: "opacity",
          keyframes: [],
        };
        posZTrack.keyframes = [
          { id: `${obj.id}-dr-0`, timeMs: 0, value: baseZ - 0.5, easing: "ease-out" },
          { id: `${obj.id}-dr-1`, timeMs: durationMs, value: baseZ, easing: "ease-out" },
        ];
        opacityTrack.keyframes = [
          { id: `${obj.id}-dr-op-0`, timeMs: 0, value: 0, easing: "ease-out" },
          { id: `${obj.id}-dr-op-1`, timeMs: durationMs * 0.4, value: obj.opacity, easing: "ease-out" },
        ];
        return {
          ...obj,
          animationTracks: tracks
            .filter((t) => t.property !== "position.z" && t.property !== "opacity")
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
