import { describe, expect, it } from "vitest";
import { createEffectPlan } from "../holographic/effect-plan";
import { createHoloScene } from "./holo-scene";
import { createHoloSceneState, holoSceneReducer } from "./scene-store";

function fixture() {
  return createHoloScene(
    createEffectPlan({
      creationType: "chrome",
      presetId: "iridescent-chrome",
    }),
  );
}

describe("HoloScene reducer", () => {
  it("selects the first object by default", () => {
    const scene = fixture();
    expect(createHoloSceneState(scene).selectedObjectId).toBe(scene.objects[0]?.id);
  });

  it("patches an object transform without mutating the source scene", () => {
    const scene = fixture();
    const state = createHoloSceneState(scene);
    const next = holoSceneReducer(state, {
      type: "patch_transform",
      objectId: scene.objects[0]!.id,
      transform: { position: { z: 1.4 } },
    });

    expect(scene.objects[0]?.transform.position.z).toBe(0);
    expect(next.scene.objects[0]?.transform.position.z).toBe(1.4);
  });

  it("patches scene lighting without mutating the source environment", () => {
    const scene = fixture();
    const state = createHoloSceneState(scene);
    const next = holoSceneReducer(state, {
      type: "patch_environment",
      environment: {
        background: "#101827",
        ambientIntensity: 1.25,
        keyLightIntensity: 3.5,
        rimLightIntensity: 2.4,
        floorGrid: false,
      },
    });

    expect(scene.environment.background).toBe("#020307");
    expect(next.scene.environment).toMatchObject({
      background: "#101827",
      ambientIntensity: 1.25,
      keyLightIntensity: 3.5,
      rimLightIntensity: 2.4,
      floorGrid: false,
    });
  });

  it("patches camera vectors and clamps unsafe lens values", () => {
    const scene = fixture();
    const state = createHoloSceneState(scene);
    const next = holoSceneReducer(state, {
      type: "patch_camera",
      camera: {
        position: { x: 2.25, y: 1.25, z: 4.65 },
        target: { y: 0.1 },
        fov: 500,
        near: -4,
        far: 0,
      },
    });

    expect(scene.camera.position.x).toBe(0);
    expect(next.scene.camera.position).toEqual({ x: 2.25, y: 1.25, z: 4.65 });
    expect(next.scene.camera.target.y).toBe(0.1);
    expect(next.scene.camera.fov).toBe(110);
    expect(next.scene.camera.near).toBe(0.001);
    expect(next.scene.camera.far).toBeCloseTo(0.011);
  });

  it("patches object material and geometry with bounded renderer values", () => {
    const scene = fixture();
    const state = createHoloSceneState(scene);
    const objectId = scene.objects[0]!.id;

    const next = holoSceneReducer(state, {
      type: "patch_object",
      objectId,
      patch: {
        visible: false,
        material: {
          opacity: 4,
          metalness: -3,
          roughness: 0,
          transmission: 7,
          ior: 9,
          emissionStrength: 8,
          spectralShift: 140,
          diffraction: -2,
          reflectionStrength: 200,
        },
        geometry: {
          thickness: 4,
          bevelSize: -1,
          bevelSegments: 12.4,
        },
      },
    });

    const original = scene.objects[0]!;
    const patched = next.scene.objects[0]!;
    expect(original.visible).toBe(true);
    expect(patched.visible).toBe(false);
    expect(patched.material.opacity).toBe(1);
    expect(patched.material.metalness).toBe(0);
    expect(patched.material.roughness).toBe(0.02);
    expect(patched.material.transmission).toBe(1);
    expect(patched.material.ior).toBe(2.5);
    expect(patched.material.emissionStrength).toBe(5);
    expect(patched.material.spectralShift).toBe(100);
    expect(patched.material.diffraction).toBe(0);
    expect(patched.material.reflectionStrength).toBe(100);
    expect(patched.geometry.thickness).toBe(2);
    expect(patched.geometry.bevelSize).toBe(0);
    expect(patched.geometry.bevelSegments).toBe(8);
  });

  it("clamps timeline changes to scene duration", () => {
    const state = createHoloSceneState(fixture());
    const next = holoSceneReducer(state, {
      type: "set_time",
      currentTimeMs: 999999,
    });
    expect(next.scene.timeline.currentTimeMs).toBe(next.scene.timeline.durationMs);
  });

  it("authors and removes a transform pose at the current time", () => {
    let state = createHoloSceneState(fixture());
    const objectId = state.scene.objects[0]!.id;

    state = holoSceneReducer(state, {
      type: "set_time",
      currentTimeMs: 1500,
    });
    state = holoSceneReducer(state, {
      type: "upsert_transform_pose",
      objectId,
      timeMs: 1500,
    });

    expect(state.scene.objects[0]?.animationPreset).toBe("custom");
    expect(state.scene.objects[0]?.animationTracks).toHaveLength(3);

    state = holoSceneReducer(state, {
      type: "remove_transform_pose",
      objectId,
      timeMs: 1500,
    });

    expect(state.scene.objects[0]?.animationTracks).toHaveLength(0);
  });

  it("switches built-in animation presets and clears animation state", () => {
    let state = createHoloSceneState(fixture());
    const objectId = state.scene.objects[0]!.id;

    state = holoSceneReducer(state, {
      type: "set_animation_preset",
      objectId,
      preset: "turntable",
    });
    expect(state.scene.objects[0]?.animationPreset).toBe("turntable");

    state = holoSceneReducer(state, {
      type: "clear_animation",
      objectId,
    });
    expect(state.scene.objects[0]?.animationPreset).toBe("static");
    expect(state.scene.objects[0]?.animationTracks).toEqual([]);
  });
});
