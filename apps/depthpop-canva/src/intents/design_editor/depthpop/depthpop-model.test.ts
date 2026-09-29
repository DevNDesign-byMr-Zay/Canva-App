import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopExecutionParameters,
  getDepthPopExecutionCapability,
  getDepthPopInferenceSteps,
  normalizeDepthPopSettings,
} from "./depthpop-model";

describe("DepthPop Drive-parity contract", () => {
  it("normalizes controls to the maintained Drive ranges", () => {
    expect(
      normalizeDepthPopSettings({
        depthStrength: 2,
        depthBlur: -2,
        depthFidelity: Number.NaN,
        quality: "fast",
      }),
    ).toEqual({
      depthStrength: 0.75,
      depthBlur: 0,
      depthFidelity: 0.05,
      quality: "fast",
    });
  });

  it("uses the v115 visible defaults", () => {
    expect(DEFAULT_DEPTHPOP_SETTINGS).toEqual({
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      quality: "cinematic",
    });
  });

  it("normalizes omitted values and invalid quality back to the Drive defaults", () => {
    expect(normalizeDepthPopSettings()).toEqual(DEFAULT_DEPTHPOP_SETTINGS);
    expect(normalizeDepthPopSettings({ quality: "unsupported" as never })).toEqual(
      DEFAULT_DEPTHPOP_SETTINGS,
    );
  });

  it("clamps the opposite ends of every maintained Drive range", () => {
    expect(
      normalizeDepthPopSettings({
        depthStrength: 0,
        depthBlur: 500,
        depthFidelity: 4,
        quality: "balanced",
      }),
    ).toEqual({
      depthStrength: 0.05,
      depthBlur: 100,
      depthFidelity: 1,
      quality: "balanced",
    });
  });

  it("maps quality presets to the same hidden inference-step values", () => {
    expect(getDepthPopInferenceSteps("fast")).toBe(14);
    expect(getDepthPopInferenceSteps("balanced")).toBe(22);
    expect(getDepthPopInferenceSteps("cinematic")).toBe(34);
  });

  it("builds the provider parameter contract without inventing Canva-only controls", () => {
    expect(buildDepthPopExecutionParameters(DEFAULT_DEPTHPOP_SETTINGS)).toEqual({
      strength: 0.32,
      bokehPercent: 35,
      depthFidelity: 0.95,
      numInferenceSteps: 34,
    });
  });

  it("fails closed until an authenticated processing provider exists", () => {
    const capability = getDepthPopExecutionCapability();
    expect(capability.available).toBe(false);
    expect(capability.reason).toMatch(/authenticated image-effect provider/i);
  });
});
