import { describe, expect, it } from "vitest";

import type { SceneTransform } from "../scene/holo-scene";
import {
  poseTimes,
  removePoseAtTime,
  sampleTransformTracks,
  upsertTransformPose,
} from "./keyframe-model";

const transform = (x: number): SceneTransform => ({
  position: {x,y:0,z:0},
  rotation: {x:0,y:x/10,z:0},
  scale: {x:1+x/10,y:1+x/10,z:1+x/10},
});

describe("HoloForge keyframe model", () => {
  it("stores one synchronized pose across transform tracks", () => {
    const tracks = upsertTransformPose([], transform(0), 1000);
    expect(tracks).toHaveLength(3);
    expect(poseTimes(tracks)).toEqual([1000]);
  });

  it("interpolates transform values between poses", () => {
    let tracks = upsertTransformPose([], transform(0), 0, "linear");
    tracks = upsertTransformPose(tracks, transform(2), 2000, "linear");

    const sample = sampleTransformTracks(tracks, 1000);
    expect(sample.position?.x).toBeCloseTo(1);
    expect(sample.rotation?.y).toBeCloseTo(0.1);
    expect(sample.scale?.x).toBeCloseTo(1.1);
  });

  it("replaces an existing pose at the same time instead of duplicating it", () => {
    let tracks = upsertTransformPose([], transform(0), 0);
    tracks = upsertTransformPose(tracks, transform(5), 0);
    expect(poseTimes(tracks)).toEqual([0]);
    expect(sampleTransformTracks(tracks, 0).position?.x).toBe(5);
  });

  it("removes a synchronized pose from all tracks", () => {
    let tracks = upsertTransformPose([], transform(0), 0);
    tracks = upsertTransformPose(tracks, transform(3), 3000);
    tracks = removePoseAtTime(tracks, 3000);
    expect(poseTimes(tracks)).toEqual([0]);
  });
});
