import { describe, expect, it } from "vitest";
import { createEffectPlan } from "../holographic/effect-plan";
import { createHoloScene, validateHoloScene } from "./holo-scene";

describe("HoloScene contract", () => {
  it("normalizes a HoloForge plan into schema version 1", () => {
    const plan = createEffectPlan({
      creationType: "holo_graphic",
      presetId: "iridescent-chrome",
      sourceImageRef: "source-ref" as never,
      sourceKind: "uploaded",
    });

    const scene = createHoloScene(plan, "data:image/png;base64,AAAA");

    expect(scene.schemaVersion).toBe(1);
    expect(scene.source.type).toBe("raster");
    expect(scene.source.assetId).toBe("source-ref");
    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0]?.geometry.sourceUrl).toBe("data:image/png;base64,AAAA");
    expect(scene.objects[0]?.animationPreset).toBe("sweep");
    expect(validateHoloScene(scene)).toEqual([]);
  });

  it("preserves user text as a real scene source", () => {
    const plan = createEffectPlan({
      creationType: "holo_text",
      presetId: "prism-foil",
      sourceText: "MR. ZAY",
    });

    const scene = createHoloScene(plan);
    expect(scene.source).toMatchObject({ type: "text", text: "MR. ZAY" });
    expect(scene.objects[0]).toMatchObject({
      creationType: "holo_text",
      sourceText: "MR. ZAY",
    });
  });

  it("accepts time-sorted keyframe tracks inside the scene contract", () => {
    const plan = createEffectPlan({
      creationType: "chrome",
      presetId: "iridescent-chrome",
    });
    const scene = createHoloScene(plan);
    const object = scene.objects[0]!;
    const animated = {
      ...scene,
      objects: [{
        ...object,
        animationPreset: "custom" as const,
        animationTracks: [{
          id: "track-position",
          property: "position" as const,
          keyframes: [
            {id:"position-0",timeMs:0,value:{x:0,y:0,z:0},easing:"linear" as const},
            {id:"position-1000",timeMs:1000,value:{x:1,y:0,z:0},easing:"ease-in-out" as const},
          ],
        }],
      }],
    };

    expect(validateHoloScene(animated)).toEqual([]);
  });

  it("rejects keyframes outside the scene timeline", () => {
    const plan = createEffectPlan({
      creationType: "chrome",
      presetId: "iridescent-chrome",
    });
    const scene = createHoloScene(plan);
    const object = scene.objects[0]!;
    const invalid = {
      ...scene,
      objects: [{
        ...object,
        animationTracks: [{
          id: "track-position",
          property: "position" as const,
          keyframes: [
            {
              id:"position-late",
              timeMs:scene.timeline.durationMs + 1,
              value:{x:0,y:0,z:0},
              easing:"linear" as const,
            },
          ],
        }],
      }],
    };

    expect(validateHoloScene(invalid).join(" ")).toMatch(/outside the timeline/i);
  });

  it("keeps material values normalized for WebGL", () => {
    const plan = createEffectPlan({
      creationType: "glass",
      presetId: "aurora-glass",
    });

    const scene = createHoloScene(plan);
    const material = scene.objects[0]!.material;
    expect(material.opacity).toBeGreaterThanOrEqual(0);
    expect(material.opacity).toBeLessThanOrEqual(1);
    expect(material.transmission).toBeGreaterThan(0);
    expect(material.ior).toBeGreaterThan(1);
  });
});
