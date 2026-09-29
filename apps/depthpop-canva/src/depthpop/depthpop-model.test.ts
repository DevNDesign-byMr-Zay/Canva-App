import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopPayload,
  normalizeDepthPopSettings,
} from "./depthpop-model";

describe("DepthPop Drive v115 contract", () => {
  it("keeps the exact maintained Drive defaults", () => {
    expect(DEFAULT_DEPTHPOP_SETTINGS).toEqual({
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      steps: 28,
    });
  });

  it("clamps every Drive control to its original range", () => {
    expect(
      normalizeDepthPopSettings({
        depthStrength: 4,
        depthBlur: -10,
        depthFidelity: 3,
        steps: 100,
      }),
    ).toEqual({
      depthStrength: 0.75,
      depthBlur: 0,
      depthFidelity: 1,
      steps: 50,
    });
  });

  it("maps controls directly into the backend request without invented presets", () => {
    expect(buildDepthPopPayload("https://example.com/image.png", DEFAULT_DEPTHPOP_SETTINGS)).toEqual({
      sourceUrl: "https://example.com/image.png",
      strength: 0.32,
      bokeh: 35,
      depthFidelity: 0.95,
      numInferenceSteps: 28,
    });
  });
});
