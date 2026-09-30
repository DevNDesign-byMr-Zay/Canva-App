import { describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  initAppElement: () => ({ addElement: vi.fn(async () => undefined) }),
}));

import { createEffectPlan } from "./effect-plan";
import {
  canExecuteHolographicPlan,
  executeHolographicEffectPlan,
  previewOnlyProperties,
} from "./effect-executor";

function plan(creationType: Parameters<typeof createEffectPlan>[0]["creationType"] = "chrome") {
  return createEffectPlan({ creationType, presetId: "iridescent-chrome" });
}

describe("holographic effect executor", () => {
  it("executes a supported app-owned holographic effect", async () => {
    const addEffect = vi.fn(async () => undefined);
    const result = await executeHolographicEffectPlan(plan(), { addEffect });

    expect(addEffect).toHaveBeenCalledTimes(1);
    expect(result.route).toBe("APP_OWNED_EFFECT");
    expect(result.data.presetId).toBe("iridescent-chrome");
    expect(result.previewOnlyProperties).toEqual(expect.arrayContaining(["depth", "motionMode"]));
  });

  it("does not execute unbound Holo Text creation", async () => {
    const addEffect = vi.fn(async () => undefined);
    await expect(executeHolographicEffectPlan(plan("holo_text"), { addEffect })).rejects.toThrow(
      /source-text binding/i,
    );
    expect(addEffect).not.toHaveBeenCalled();
  });

  it("reports forge availability from the execution route", () => {
    expect(canExecuteHolographicPlan(plan("chrome"))).toBe(true);
    expect(canExecuteHolographicPlan(plan("holo_logo"))).toBe(false);
  });

  it("keeps spatial and motion properties in preview", () => {
    expect(previewOnlyProperties(plan())).toEqual(expect.arrayContaining(["depth", "motionMode"]));
  });
});
