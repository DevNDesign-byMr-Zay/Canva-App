import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addElement: vi.fn(async () => undefined),
}));

vi.mock("@canva/design", () => ({
  initAppElement: () => ({ addElement: mocks.addElement }),
}));

import { createEffectPlan } from "./effect-plan";
import {
  appElementDataFromPlan,
  canvaAppOwnedEffectAdapter,
  holographicSvgDataUrl,
  renderHolographicSvg,
  type HolographicAppElementData,
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

  it("escapes material labels and clamps visual percentages", () => {
    const data: HolographicAppElementData = {
      version: 2,
      creationType: "holo_graphic",
      presetId: "gold&glass",
      family: "iridescent",
      colorShift: 150,
      depth: 50,
      reflection: 0,
      glow: 100,
      grain: 100,
      angle: 360,
      transparency: 100,
      motionMode: "static",
    };

    const svg = renderHolographicSvg(data);
    expect(svg).toContain("GOLD&amp;GLASS");
    expect(svg).toContain('opacity="0"');
  });

  it("renders source text as a holographic text element", () => {
    const plan = createEffectPlan({
      creationType: "holo_text",
      presetId: "prism-foil",
      sourceText: "MR. ZAY",
    });
    const preset = getPresetById(plan.presetId)!;
    const data = appElementDataFromPlan(plan, preset.family);
    const svg = renderHolographicSvg(data);

    expect(data.sourceText).toBe("MR. ZAY");
    expect(svg).toContain("MR. ZAY");
    expect(svg).toContain("textGlow");
  });

  it("adds a real app-owned element through the Canva adapter", async () => {
    const plan = createEffectPlan({ creationType: "light_fx", presetId: "neon-haze" });
    const preset = getPresetById(plan.presetId)!;
    const data = appElementDataFromPlan(plan, preset.family);

    await canvaAppOwnedEffectAdapter.addEffect(data);
    expect(mocks.addElement).toHaveBeenCalledWith({ data });
  });
});
