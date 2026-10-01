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

  it("clamps timeline changes to scene duration", () => {
    const state = createHoloSceneState(fixture());
    const next = holoSceneReducer(state, {
      type: "set_time",
      currentTimeMs: 999999,
    });
    expect(next.scene.timeline.currentTimeMs).toBe(next.scene.timeline.durationMs);
  });
});
