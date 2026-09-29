import { describe, expect, it } from "vitest";

import { createEffectPlan } from "./effect-plan";
import { getGeneratedAssetCapability } from "./generated-asset-adapter";

describe("generated asset capability", () => {
  it("reports generation unavailable until an authenticated provider exists", () => {
    const plan = createEffectPlan({
      creationType: "holo_graphic",
      presetId: "prism-foil",
    });

    expect(getGeneratedAssetCapability(plan)).toEqual({
      available: false,
      reason:
        "No authenticated generated-asset provider is configured. HoloForge will not pretend this route is available.",
    });
  });
});
