import { describe, expect, it } from "vitest";
import { isDepthScene } from "./depth-scene";

function validScene() {
  return {
    schemaVersion: 1,
    id: "scene_test123",
    sourceAssetId: "asset_abc",
    width: 800,
    height: 600,
    settings: {
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      renderQuality: "cinematic",
      numInferenceSteps: 34,
    },
    objects: [
      {
        id: "person_01",
        label: "person",
        semanticType: "person",
        extractionQuality: "mask",
        confidence: 0.98,
        bbox: { x: 100, y: 100, width: 200, height: 400 },
        assets: {
          cutoutUrl: "/api/v1/assets/cutout",
          maskUrl: "/api/v1/assets/mask",
          thumbnailUrl: "/api/v1/assets/thumb",
        },
        depth: { mean: 0.3, median: 0.28, min: 0.2, max: 0.4 },
        transform: {
          position: { x: 0.5, y: 0.5, z: 0.2 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        opacity: 1,
        feather: 0,
        visible: true,
        locked: false,
        order: 0,
        animationTracks: [
          {
            id: "track-position-x",
            property: "position.x",
            keyframes: [
              { timeMs: 0, value: 0.5, easing: "linear" },
              { timeMs: 1000, value: 0.7, easing: "ease-in-out" },
            ],
          },
        ],
      },
    ],
    reconstructedPlate: {
      imageUrl: "/api/v1/assets/plate",
      depthMapUrl: "/api/v1/assets/depth",
    },
    camera: {
      position: { x: 0, y: 0, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    },
    timeline: {
      durationMs: 2000,
      fps: 30,
      currentTimeMs: 500,
    },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
}

describe("DepthScene Contract", () => {
  it("accepts a valid scene with typed animation tracks and settings", () => {
    expect(isDepthScene(validScene())).toBe(true);
  });

  it("rejects unsupported animation properties", () => {
    const scene = validScene();
    scene.objects[0]!.animationTracks[0]!.property = "depth.mean";
    expect(isDepthScene(scene)).toBe(false);
  });

  it("rejects duplicate keyframe times", () => {
    const scene = validScene();
    scene.objects[0]!.animationTracks[0]!.keyframes = [
      { timeMs: 500, value: 0.5, easing: "linear" },
      { timeMs: 500, value: 0.8, easing: "ease-in" },
    ];
    expect(isDepthScene(scene)).toBe(false);
  });

  it("rejects non-finite animation values", () => {
    const scene = validScene();
    scene.objects[0]!.animationTracks[0]!.keyframes[0]!.value = Number.NaN;
    expect(isDepthScene(scene)).toBe(false);
  });

  it("rejects opacity keyframes outside 0..1", () => {
    const scene = validScene();
    scene.objects[0]!.animationTracks[0] = {
      id: "track-opacity",
      property: "opacity",
      keyframes: [
        { timeMs: 0, value: 1.25, easing: "linear" },
      ],
    };
    expect(isDepthScene(scene)).toBe(false);
  });

  it("rejects keyframes beyond the timeline duration", () => {
    const scene = validScene();
    scene.objects[0]!.animationTracks[0]!.keyframes[1]!.timeMs = 2500;
    expect(isDepthScene(scene)).toBe(false);
  });

  it("rejects invalid scene objects", () => {
    expect(isDepthScene(null)).toBe(false);
    expect(isDepthScene({})).toBe(false);
    expect(isDepthScene({ schemaVersion: 2 })).toBe(false);
    expect(isDepthScene({ schemaVersion: 1, id: "123" })).toBe(false);
  });
});
