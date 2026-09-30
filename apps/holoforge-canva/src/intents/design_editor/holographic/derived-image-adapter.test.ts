import { describe, expect, it } from "vitest";

import { applyHolographicPixels } from "./derived-image-adapter";
import type { HolographicEffectPlan } from "./effect-plan";

function plan(overrides: Partial<HolographicEffectPlan["parameters"]> = {}) {
  return {
    creationType: "holo_logo" as const,
    parameters: {
      colorShift: 85,
      depth: 60,
      reflection: 95,
      glow: 40,
      grain: 10,
      angle: 45,
      transparency: 0,
      motionMode: "sweep" as const,
      ...overrides,
    },
  };
}

describe("HoloForge derived-image material engine", () => {
  it("preserves transparent pixels while transforming visible color", () => {
    const pixels = new Uint8ClampedArray([
      120, 120, 120, 255,
      10, 20, 30, 0,
    ]);

    applyHolographicPixels(pixels, 2, 1, plan());

    expect(Array.from(pixels.slice(0, 3))).not.toEqual([120, 120, 120]);
    expect(pixels[3]).toBe(255);
    expect(Array.from(pixels.slice(4, 8))).toEqual([10, 20, 30, 0]);
  });

  it("applies material transparency to visible source pixels", () => {
    const pixels = new Uint8ClampedArray([80, 120, 160, 200]);
    applyHolographicPixels(pixels, 1, 1, plan({ transparency: 25 }));
    expect(pixels[3]).toBe(150);
  });

  it("is deterministic for the same material recipe", () => {
    const a = new Uint8ClampedArray([40, 80, 120, 255, 200, 160, 90, 255]);
    const b = new Uint8ClampedArray(a);
    applyHolographicPixels(a, 2, 1, plan({ grain: 55, angle: 210 }));
    applyHolographicPixels(b, 2, 1, plan({ grain: 55, angle: 210 }));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
