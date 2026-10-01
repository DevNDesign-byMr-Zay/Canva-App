import type { HoloAnimationPreset, Vec3 } from "../scene/holo-scene";

export type PresetMotionDelta = Readonly<{
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}>;

const ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });
const ONE: Vec3 = Object.freeze({ x: 1, y: 1, z: 1 });

export function samplePresetMotion(
  preset: HoloAnimationPreset,
  timeSeconds: number,
): PresetMotionDelta {
  const time = Math.max(0, Number.isFinite(timeSeconds) ? timeSeconds : 0);
  let position = ZERO;
  let rotation = ZERO;
  let scale = ONE;

  switch (preset) {
    case "shimmer":
      rotation = Object.freeze({
        x: Math.cos(time * 0.8) * 0.045,
        y: Math.sin(time * 1.25) * 0.18,
        z: 0,
      });
      break;
    case "sweep":
      rotation = Object.freeze({ x: 0, y: time * 0.34, z: 0 });
      break;
    case "pulse": {
      const pulse = 1 + Math.sin(time * 2.4) * 0.045;
      scale = Object.freeze({ x: pulse, y: pulse, z: pulse });
      break;
    }
    case "turntable":
      rotation = Object.freeze({ x: 0, y: time * 0.5, z: 0 });
      break;
    case "orbit":
      position = Object.freeze({
        x: Math.cos(time * 0.55) * 0.32,
        y: 0,
        z: Math.sin(time * 0.55) * 0.18,
      });
      break;
    default:
      break;
  }

  return Object.freeze({ position, rotation, scale });
}
