import { describe, expect, it } from "vitest";

import type { DepthScene } from "../scene/depth-scene";
import { applyMotionPreset } from "./motion-presets";

function scene(): DepthScene {
  return {
    schemaVersion: 1,
    id: "scene-motion",
    sourceAssetId: "source",
    width: 1000,
    height: 1000,
    settings: {
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      renderQuality: "cinematic",
      numInferenceSteps: 34,
    },
    objects: [
      {
        id: "hero",
        label: "Hero",
        semanticType: "person",
        confidence: 1,
        bbox: { x: 250, y: 250, width: 500, height: 500 },
        assets: {
          cutoutUrl: "data:image/png;base64,a",
          maskUrl: "data:image/png;base64,a",
          thumbnailUrl: "data:image/png;base64,a",
        },
        depth: { mean: 0.8, median: 0.8, min: 0.7, max: 0.9 },
        transform: {
          position: { x: 0.5, y: 0.5, z: 0.8 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        opacity: 1,
        feather: 0,
        visible: true,
        locked: false,
        order: 0,
        animationTracks: [],
      },
    ],
    reconstructedPlate: {
      imageUrl: "data:image/png;base64,a",
      depthMapUrl: "data:image/png;base64,a",
    },
    camera: {
      position: { x: 0, y: 0, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    },
    timeline: { durationMs: 3000, fps: 30, currentTimeMs: 0 },
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
  };
}

describe("DepthPop motion presets", () => {
  for (const preset of [
    "PARALLAX",
    "CAMERA_PUSH",
    "FLOAT",
    "ORBIT",
    "DEPTH_REVEAL",
    "RACK_FOCUS",
  ] as const) {
    it(`${preset} authors serializable animation data`, () => {
      const original = scene();
      const result = applyMotionPreset(original, preset);
      expect(result).not.toBe(original);
      expect(result.objects[0]!.animationTracks.length).toBeGreaterThan(0);
      for (const track of result.objects[0]!.animationTracks) {
        expect(track.keyframes.length).toBeGreaterThan(0);
        expect(
          track.keyframes.every(
            (keyframe) =>
              keyframe.timeMs >= 0 &&
              keyframe.timeMs <= result.timeline.durationMs,
          ),
        ).toBe(true);
      }
    });
  }

  it("ORBIT authors both planar motion and rotation", () => {
    const result = applyMotionPreset(scene(), "ORBIT");
    const properties = new Set(
      result.objects[0]!.animationTracks.map((track) => track.property),
    );
    expect(properties).toEqual(
      new Set(["position.x", "position.y", "rotation.z"]),
    );
  });

  it("RACK_FOCUS remains truthful to DepthScene v1 supported tracks", () => {
    const result = applyMotionPreset(scene(), "RACK_FOCUS");
    const properties = new Set(
      result.objects[0]!.animationTracks.map((track) => track.property),
    );
    expect(properties).toEqual(new Set(["opacity", "position.z"]));
  });
});
