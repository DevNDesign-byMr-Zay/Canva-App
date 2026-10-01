import { describe, expect, it } from "vitest";
import { DepthScene } from "../scene/depth-scene";
import { SceneState, sceneReducer } from "./scene-reducer";

const testScene: DepthScene = {
  schemaVersion: 1,
  id: "scene_test1",
  sourceAssetId: "asset_1",
  width: 200,
  height: 200,
  objects: [
    {
      id: "person_01",
      label: "person",
      semanticType: "person",
      confidence: 0.95,
      bbox: { x: 20, y: 20, width: 80, height: 80 },
      assets: {
        cutoutUrl: "http://test/cutout1.png",
        maskUrl: "http://test/mask1.png",
        thumbnailUrl: "http://test/thumb1.png",
      },
      depth: { mean: 0.8, median: 0.82, min: 0.7, max: 0.9 },
      transform: {
        position: { x: 0.5, y: 0.5, z: 0.5 },
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
    imageUrl: "http://test/plate.png",
    depthMapUrl: "http://test/depth.png",
  },
  camera: {
    position: { x: 0, y: 0, z: 5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
  },
  timeline: { durationMs: 0, fps: 30, currentTimeMs: 0 },
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

const initialState: SceneState = {
  initialScene: testScene,
  currentScene: testScene,
  selectedObjectId: "person_01",
  parallaxStrength: 1.0,
};

describe("sceneReducer", () => {
  it("updates position X/Y/Z transform immutably", () => {
    const next = sceneReducer(initialState, {
      type: "PATCH_TRANSFORM",
      objectId: "person_01",
      transform: { position: { x: 0.8, y: 0.2, z: 1.2 } },
    });

    expect(next.currentScene.objects[0].transform.position).toEqual({
      x: 0.8,
      y: 0.2,
      z: 1.2,
    });
    expect(initialState.currentScene.objects[0].transform.position).toEqual({
      x: 0.5,
      y: 0.5,
      z: 0.5,
    });
  });

  it("rejects transform updates when object is locked", () => {
    const lockedState = sceneReducer(initialState, {
      type: "SET_LOCK",
      objectId: "person_01",
      locked: true,
    });

    const attempt = sceneReducer(lockedState, {
      type: "PATCH_TRANSFORM",
      objectId: "person_01",
      transform: { position: { x: 0.9, y: 0.9, z: 0.9 } },
    });

    expect(attempt.currentScene.objects[0].transform.position).toEqual({
      x: 0.5,
      y: 0.5,
      z: 0.5,
    });
  });

  it("updates visibility and resets scene cleanly", () => {
    const hiddenState = sceneReducer(initialState, {
      type: "SET_VISIBILITY",
      objectId: "person_01",
      visible: false,
    });
    expect(hiddenState.currentScene.objects[0].visible).toBe(false);

    const resetState = sceneReducer(hiddenState, { type: "RESET_SCENE" });
    expect(resetState.currentScene.objects[0].visible).toBe(true);
  });
});
