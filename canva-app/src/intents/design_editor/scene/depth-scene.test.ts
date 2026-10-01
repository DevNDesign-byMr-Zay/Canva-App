import { describe, expect, it } from "vitest";
import { DepthScene, isDepthScene } from "./depth-scene";

describe("DepthScene Contract", () => {
  it("validates a correct DepthScene object", () => {
    const validScene: DepthScene = {
      schemaVersion: 1,
      id: "scene_test123",
      sourceAssetId: "asset_abc",
      width: 800,
      height: 600,
      objects: [
        {
          id: "person_01",
          label: "person",
          semanticType: "person",
          confidence: 0.98,
          bbox: { x: 100, y: 100, width: 200, height: 400 },
          assets: {
            cutoutUrl: "https://cdn.example.com/cutout.png",
            maskUrl: "https://cdn.example.com/mask.png",
            thumbnailUrl: "https://cdn.example.com/thumb.png",
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
          animationTracks: [],
        },
      ],
      reconstructedPlate: {
        imageUrl: "https://cdn.example.com/plate.png",
        depthMapUrl: "https://cdn.example.com/depth.png",
      },
      camera: {
        position: { x: 0, y: 0, z: 5 },
        target: { x: 0, y: 0, z: 0 },
        fov: 50,
      },
      timeline: {
        durationMs: 0,
        fps: 30,
        currentTimeMs: 0,
      },
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    };

    expect(isDepthScene(validScene)).toBe(true);
  });

  it("rejects invalid scene objects", () => {
    expect(isDepthScene(null)).toBe(false);
    expect(isDepthScene({})).toBe(false);
    expect(isDepthScene({ schemaVersion: 2 })).toBe(false);
    expect(isDepthScene({ schemaVersion: 1, id: "123" })).toBe(false);
  });
});
