import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEPTHPOP_SETTINGS,
  buildDepthPopPreviewModel,
  getDepthPopExecutionCapability,
  normalizeDepthPopSettings,
} from "./depthpop-model";

describe("DepthPop preview model", () => {
  it("normalizes controls to the supported range", () => {
    expect(
      normalizeDepthPopSettings({
        depth: 140,
        bokeh: -2,
        focus: Number.NaN,
        edgeLift: 55,
        quality: "max",
      }),
    ).toEqual({
      depth: 100,
      bokeh: 0,
      focus: 0,
      edgeLift: 55,
      quality: "max",
    });
  });

  it("builds deterministic preview geometry", () => {
    const first = buildDepthPopPreviewModel(DEFAULT_DEPTHPOP_SETTINGS);
    const second = buildDepthPopPreviewModel(DEFAULT_DEPTHPOP_SETTINGS);
    expect(first).toEqual(second);
    expect(first.foregroundScale).toBeGreaterThan(first.subjectScale);
    expect(first.subjectScale).toBeGreaterThan(first.backgroundScale);
    expect(first.backgroundBlurPx).toBeGreaterThan(0);
  });

  it("fails closed until an authenticated processing provider exists", () => {
    const capability = getDepthPopExecutionCapability();
    expect(capability.available).toBe(false);
    expect(capability.reason).toMatch(/authenticated image-effect provider/i);
  });
});
