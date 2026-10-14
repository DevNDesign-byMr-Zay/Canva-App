import { describe, expect, it } from "vitest";
import type { DepthObject } from "../scene/depth-scene";
import { animationValue, sampledAnimationValue, upsertPose, removePose, poseTimes } from "./pose-utils";

const fixture = (): DepthObject => ({
  id: "bottle_01",
  label: "Bottle",
  semanticType: "product",
  confidence: 1,
  bbox: { x: 10, y: 12, width: 30, height: 40 },
  assets: { cutoutUrl: "", maskUrl: "", thumbnailUrl: "" },
  depth: { mean: 0.4, median: 0.4, min: 0.2, max: 0.7 },
  transform: {
    position: { x: 0.25, y: 0.5, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  opacity: 1,
  feather: 0,
  visible: true,
  locked: false,
  order: 0,
  animationTracks: [],
});

describe("object pose helpers", () => {
  it("writes an initial frame and a selected pose without mutating the source", () => {
    const object = fixture();
    const tracks = upsertPose(object, 500, "ease-in-out", { "position.x": 0.8 });
    expect(tracks).toHaveLength(10);
    expect(tracks.find((track) => track.property === "position.x")?.keyframes).toEqual([
      { timeMs: 0, value: 0.25, easing: "linear" },
      { timeMs: 500, value: 0.8, easing: "ease-in-out" },
    ]);
    expect(object.animationTracks).toEqual([]);
  });

  it("replaces a keyframe at the same time instead of adding duplicates", () => {
    const first = upsertPose(fixture(), 500, "linear", { "position.z": 2 });
    const next = upsertPose({ ...fixture(), animationTracks: first }, 500, "ease-out", { "position.z": 3 });
    expect(next.find((track) => track.property === "position.z")?.keyframes).toEqual([
      { timeMs: 0, value: 1, easing: "linear" },
      { timeMs: 500, value: 3, easing: "ease-out" },
    ]);
    expect(first.find((track) => track.property === "position.z")?.keyframes[1]?.value).toBe(2);
  });

  it("samples interpolated values and preserves the static fallback", () => {
    const object = fixture();
    expect(animationValue(object, "opacity")).toBe(1);
    expect(sampledAnimationValue(object, "position.x", 250)).toBe(0.25);
    const withPose = { ...object, animationTracks: upsertPose(object, 500, "linear", { "position.x": 0.75 }) };
    expect(sampledAnimationValue(withPose, "position.x", 250)).toBeCloseTo(0.5);
  });

  it("deletes only matching pose time and returns sorted distinct times", () => {
    const object = fixture();
    const first = upsertPose(object, 750, "linear", { opacity: 0.5 });
    const second = upsertPose({ ...object, animationTracks: first }, 250, "linear", { opacity: 0.8 });
    expect(poseTimes({ ...object, animationTracks: second })).toEqual([0, 250, 750]);
    const after = removePose(second, 250);
    expect(poseTimes({ ...object, animationTracks: after })).toEqual([0, 750]);
    expect(poseTimes({ ...object, animationTracks: removePose(after, 750) })).toEqual([0]);
    expect(second[0]?.keyframes.some((frame) => frame.timeMs === 250)).toBe(true);
  });
});
