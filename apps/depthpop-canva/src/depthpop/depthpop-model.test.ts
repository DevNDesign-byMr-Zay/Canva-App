import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopFormFields,
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

  it("maps the four controls directly to backend multipart fields", () => {
    expect(buildDepthPopFormFields(DEFAULT_DEPTHPOP_SETTINGS)).toEqual({
      strength: "0.32",
      bokeh: "35",
      depth_fidelity: "0.95",
      num_inference_steps: "28",
    });
  });
});
