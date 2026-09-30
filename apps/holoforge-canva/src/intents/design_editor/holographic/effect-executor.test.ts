import { describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  initAppElement: () => ({ addElement: vi.fn(async () => undefined) }),
}));

import { createEffectPlan } from "./effect-plan";
import {
  canExecuteHolographicPlan,
  executeHolographicEffectPlan,
  previewOnlyProperties,
  resolveExecutionRoute,
} from "./effect-executor";

const appOwned = { addEffect: vi.fn(async () => undefined) };
const derivedImage = {
  addDerivedEffect: vi.fn(async () => ({ ref: "derived-ref" as never, mimeType: "image/png" as const })),
};

function plan(
  creationType: Parameters<typeof createEffectPlan>[0]["creationType"] = "chrome",
  extras: Partial<Parameters<typeof createEffectPlan>[0]> = {},
) {
  return createEffectPlan({ creationType, presetId: "iridescent-chrome", ...extras });
}

describe("holographic effect executor", () => {
  it("executes a supported app-owned holographic effect", async () => {
    appOwned.addEffect.mockClear();
    const result = await executeHolographicEffectPlan(plan(), { appOwned, derivedImage });

    expect(appOwned.addEffect).toHaveBeenCalledTimes(1);
    expect(result.route).toBe("APP_OWNED_EFFECT");
    expect(result.data?.presetId).toBe("iridescent-chrome");
    expect(result.previewOnlyProperties).toEqual(expect.arrayContaining(["motionMode"]));
    expect(result.previewOnlyProperties).not.toContain("depth");
  });

  it("executes Holo Text when text is provided", async () => {
    appOwned.addEffect.mockClear();
    const textPlan = plan("holo_text", { sourceText: "HOLO TYPE" });
    expect(canExecuteHolographicPlan(textPlan)).toBe(true);

    const result = await executeHolographicEffectPlan(textPlan, { appOwned, derivedImage });
    expect(result.route).toBe("APP_OWNED_EFFECT");
    expect(result.data?.sourceText).toBe("HOLO TYPE");
  });

  it("keeps Holo Text disabled only until text is entered", async () => {
    const textPlan = plan("holo_text");
    expect(canExecuteHolographicPlan(textPlan)).toBe(false);
    await expect(
      executeHolographicEffectPlan(textPlan, { appOwned, derivedImage }),
    ).rejects.toThrow(/enter text/i);
  });

  it("routes Holo Logo through the real derived-image engine", async () => {
    derivedImage.addDerivedEffect.mockClear();
    const logoPlan = plan("holo_logo", {
      sourceImageRef: "source-ref" as never,
      sourceKind: "uploaded",
    });

    expect(canExecuteHolographicPlan(logoPlan)).toBe(true);
    expect(resolveExecutionRoute(logoPlan)).toBe("DERIVED_IMAGE");

    const result = await executeHolographicEffectPlan(logoPlan, { appOwned, derivedImage });
    expect(derivedImage.addDerivedEffect).toHaveBeenCalledWith(logoPlan);
    expect(result.route).toBe("DERIVED_IMAGE");
    expect(result.assetRef).toBe("derived-ref");
  });

  it("uses derived-image mode for a source-bound Holo Graphic", () => {
    const graphic = plan("holo_graphic", { sourceImageRef: "source-ref" as never });
    expect(resolveExecutionRoute(graphic)).toBe("DERIVED_IMAGE");
    expect(canExecuteHolographicPlan(graphic)).toBe(true);
    expect(resolveExecutionRoute(plan("holo_graphic"))).toBe("APP_OWNED_EFFECT");
  });

  it("requires a source image for Holo Logo", () => {
    expect(canExecuteHolographicPlan(plan("holo_logo"))).toBe(false);
  });

  it("keeps only unsupported motion behavior in preview", () => {
    expect(previewOnlyProperties(plan())).toContain("motionMode");
    expect(previewOnlyProperties(plan())).not.toContain("depth");
  });
});
