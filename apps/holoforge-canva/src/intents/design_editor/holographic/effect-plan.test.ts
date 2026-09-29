import { describe, expect, it } from "vitest";
import { createEffectPlan } from "./effect-plan";

describe("effect-plan", () => {
  it("creates a valid plan from a material preset", () => {
    const plan = createEffectPlan({
      creationType: "holo_graphic",
      presetId: "iridescent-chrome",
    });

    expect(plan.version).toBe(1);
    expect(plan.creationType).toBe("holo_graphic");
    expect(plan.presetName).toBe("Iridescent Chrome");
    expect(plan.isValid).toBe(true);
    expect(plan.layers.length).toBeGreaterThan(0);
  });

  it("applies deterministic parameter overrides", () => {
    const plan = createEffectPlan({
      creationType: "glass",
      presetId: "aurora-glass",
      customParameters: { colorShift: 99, glow: 88 },
    });
    expect(plan.parameters.colorShift).toBe(99);
    expect(plan.parameters.glow).toBe(88);
  });

  it("routes existing-element transforms as native Canva edits", () => {
    const plan = createEffectPlan({
      creationType: "chrome",
      presetId: "liquid-metal",
      nativeTransform: { x: 100, y: 200, rotation: 45 },
    });
    const nativeLayers = plan.layers.filter((layer) => layer.type === "NATIVE_CANVA_EDIT");
    expect(nativeLayers).toHaveLength(3);
  });

  it("throws for an unknown preset", () => {
    expect(() =>
      createEffectPlan({
        creationType: "holo_graphic",
        presetId: "unknown-preset",
      }),
    ).toThrow("Unknown material preset ID");
  });
});
