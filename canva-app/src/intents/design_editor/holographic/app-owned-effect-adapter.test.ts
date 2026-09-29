import { describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  initAppElement: () => ({ addElement: vi.fn(async () => undefined) }),
}));

import { createEffectPlan } from "./effect-plan";
import {
  appElementDataFromPlan,
  holographicSvgDataUrl,
  renderHolographicSvg,
} from "./app-owned-effect-adapter";
import { getPresetById } from "./material-contract";

describe("app-owned holographic effect adapter", () => {
  it("renders deterministic SVG from material metadata", () => {
    const plan = createEffectPlan({ creationType: "chrome", presetId: "holo-gunmetal" });
    const preset = getPresetById(plan.presetId)!;
    const data = appElementDataFromPlan(plan, preset.family);

    const first = renderHolographicSvg(data);
    const second = renderHolographicSvg(data);
    expect(first).toBe(second);
    expect(first).toContain("<svg");
    expect(first).toContain("HOLO GUNMETAL");
    expect(holographicSvgDataUrl(data)).toMatch(/^data:image\/svg\+xml/);
  });

  it("keeps editable app-element metadata compact", () => {
    const plan = createEffectPlan({ creationType: "glass", presetId: "aurora-glass" });
    const preset = getPresetById(plan.presetId)!;
    const data = appElementDataFromPlan(plan, preset.family);

    expect(data.creationType).toBe("glass");
    expect(data.family).toBe("glass");
    expect(data.transparency).toBe(35);
    expect(JSON.stringify(data).length).toBeLessThan(5000);
  });
});
