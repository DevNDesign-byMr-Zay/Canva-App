import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopFormFields,
  normalizeDepthPopSettings,
} from "./depthpop-model";

describe("DepthPop maintained Drive runtime contract", () => {
  it("uses the final visible Cinematic preset for the maintained 28-step raw default", () => {
    expect(DEFAULT_DEPTHPOP_SETTINGS).toEqual({
      depthStrength: 0.32,
      depthBlur: 35,
      depthFidelity: 0.95,
      renderQuality: "cinematic",
    });
    expect(buildDepthPopFormFields(DEFAULT_DEPTHPOP_SETTINGS)).toEqual({
      strength: "0.32",
      bokeh: "35",
      depth_fidelity: "0.95",
      num_inference_steps: "34",
    });
  });

  it("maps Fast Balanced and Cinematic to the maintained 14 22 and 34 steps", () => {
    const fast = normalizeDepthPopSettings({ renderQuality: "fast" } as never);
    const balanced = normalizeDepthPopSettings({ renderQuality: "balanced" } as never);
    const cinematic = normalizeDepthPopSettings({ renderQuality: "cinematic" } as never);

    expect(buildDepthPopFormFields(fast).num_inference_steps).toBe("14");
    expect(buildDepthPopFormFields(balanced).num_inference_steps).toBe("22");
    expect(buildDepthPopFormFields(cinematic).num_inference_steps).toBe("34");
  });

  it("clamps continuous controls and falls back to Cinematic for an invalid quality", () => {
    expect(
      normalizeDepthPopSettings({
        depthStrength: 4,
        depthBlur: -10,
        depthFidelity: 3,
        renderQuality: "unsupported",
      } as never),
    ).toEqual({
      depthStrength: 0.75,
      depthBlur: 0,
      depthFidelity: 1,
      renderQuality: "cinematic",
    });
  });
});
