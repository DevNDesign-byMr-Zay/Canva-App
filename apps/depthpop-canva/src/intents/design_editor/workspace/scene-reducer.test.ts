import { describe, expect, it } from "vitest";
import { DepthScene } from "../scene/depth-scene";
import { SceneState, sceneReducer } from "./scene-reducer";

function makeScene(): DepthScene {
  return {
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
      {
        id: "prop_01",
        label: "prop",
        semanticType: "prop",
        confidence: 0.9,
        bbox: { x: 110, y: 30, width: 50, height: 50 },
        assets: {
          cutoutUrl: "http://test/cutout2.png",
          maskUrl: "http://test/mask2.png",
          thumbnailUrl: "http://test/thumb2.png",
        },
        depth: { mean: 0.4, median: 0.4, min: 0.3, max: 0.5 },
        transform: {
          position: { x: 0.675, y: 0.275, z: -0.4 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        opacity: 1,
        feather: 0,
        visible: true,
        locked: false,
        order: 1,
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
    timeline: { durationMs: 1000, fps: 30, currentTimeMs: 0 },
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
}

function makeState(): SceneState {
  const scene = makeScene();
  return {
    initialScene: scene,
    currentScene: scene,
    selectedObjectId: "person_01",
    parallaxStrength: 1,
  };
}

describe("sceneReducer", () => {
  it("updates one position component without resetting the others", () => {
    const state = makeState();
    const original = state.currentScene.objects[0]!.transform.position;

    const next = sceneReducer(state, {
      type: "PATCH_TRANSFORM",
      objectId: "person_01",
      transform: { position: { x: 0.8 } },
    });

    expect(next.currentScene.objects[0]!.transform.position).toEqual({
      x: 0.8,
      y: 0.5,
      z: 0.5,
    });
    expect(original).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    expect(next.currentScene.objects[1]).toBe(state.currentScene.objects[1]);
  });

  it("blocks transform, opacity, feather and reordering while locked", () => {
    const state = makeState();
    const locked = sceneReducer(state, {
      type: "SET_LOCK",
      objectId: "person_01",
      locked: true,
    });

    const transformed = sceneReducer(locked, {
      type: "PATCH_TRANSFORM",
      objectId: "person_01",
      transform: { position: { x: 0.9 } },
    });
    const faded = sceneReducer(transformed, {
      type: "SET_OPACITY",
      objectId: "person_01",
      opacity: 0.2,
    });
    const feathered = sceneReducer(faded, {
      type: "SET_FEATHER",
      objectId: "person_01",
      feather: 12,
    });
    const reordered = sceneReducer(feathered, {
      type: "MOVE_OBJECT_ORDER",
      objectId: "person_01",
      direction: "up",
    });

    const object = reordered.currentScene.objects.find(
      (item) => item.id === "person_01",
    )!;
    expect(object.transform.position.x).toBe(0.5);
    expect(object.opacity).toBe(1);
    expect(object.feather).toBe(0);
    expect(object.order).toBe(0);
  });

  it("reorders immutably and keeps unique order values", () => {
    const state = makeState();
    const next = sceneReducer(state, {
      type: "MOVE_OBJECT_ORDER",
      objectId: "person_01",
      direction: "up",
    });

    const person = next.currentScene.objects.find(
      (item) => item.id === "person_01",
    )!;
    const prop = next.currentScene.objects.find(
      (item) => item.id === "prop_01",
    )!;
    expect(person.order).toBe(1);
    expect(prop.order).toBe(0);
    expect(state.currentScene.objects[0]!.order).toBe(0);
  });

  it("resets one object and then the complete scene", () => {
    const state = makeState();
    const hidden = sceneReducer(state, {
      type: "SET_VISIBILITY",
      objectId: "person_01",
      visible: false,
    });
    const resetObject = sceneReducer(hidden, {
      type: "RESET_OBJECT",
      objectId: "person_01",
    });
    expect(resetObject.currentScene.objects[0]!.visible).toBe(true);

    const movedCamera = sceneReducer(resetObject, {
      type: "PATCH_CAMERA",
      camera: { fov: 72 },
    });
    const resetScene = sceneReducer(movedCamera, { type: "RESET_SCENE" });
    expect(resetScene.currentScene.camera.fov).toBe(50);
  });

  it("commits a saved server scene as the new reset baseline", () => {
    const state = makeState();
    const edited = sceneReducer(state, {
      type: "SET_OPACITY",
      objectId: "person_01",
      opacity: 0.4,
    });
    const saved: DepthScene = {
      ...edited.currentScene,
      updatedAt: "2026-10-01T00:01:00Z",
    };

    const committed = sceneReducer(edited, {
      type: "COMMIT_SCENE",
      scene: saved,
    });
    const reset = sceneReducer(committed, { type: "RESET_SCENE" });

    expect(reset.currentScene.updatedAt).toBe(saved.updatedAt);
    expect(reset.currentScene.objects[0]!.opacity).toBe(0.4);
  });

  it("clamps timeline and parallax controls", () => {
    const state = makeState();
    const timeline = sceneReducer(state, {
      type: "SET_TIME",
      currentTimeMs: 5000,
    });
    expect(timeline.currentScene.timeline.currentTimeMs).toBe(1000);

    const parallax = sceneReducer(timeline, {
      type: "SET_PARALLAX_STRENGTH",
      value: 9,
    });
    expect(parallax.parallaxStrength).toBe(2);
  });
});
