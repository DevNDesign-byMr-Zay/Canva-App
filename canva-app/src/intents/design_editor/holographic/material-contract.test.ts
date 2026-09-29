import { describe, expect, it } from "vitest";
import {
  CREATION_TYPES,
  getPresetById,
  MATERIAL_PRESETS,
  validateMaterialParameters,
} from "./material-contract";

describe("material-contract", () => {
  it("provides 6 creation types", () => {
    expect(CREATION_TYPES).toHaveLength(6);
    expect(CREATION_TYPES.map((type) => type.id)).toEqual([
      "holo_text",
      "holo_logo",
      "holo_graphic",
      "glass",
      "chrome",
      "light_fx",
    ]);
  });

  it("provides 9 deterministic material presets", () => {
    expect(MATERIAL_PRESETS).toHaveLength(9);
    expect(MATERIAL_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining([
        "iridescent-chrome",
        "aurora-glass",
        "prism-foil",
        "liquid-metal",
        "spectral-pearl",
        "neon-haze",
        "crystal-frost",
        "holo-gold",
        "holo-gunmetal",
      ]),
    );
  });

  it("validates parameters for every predefined preset", () => {
    for (const preset of MATERIAL_PRESETS) {
      expect(validateMaterialParameters(preset.parameters)).toBe(true);
    }
  });

  it("retrieves presets by ID", () => {
    expect(getPresetById("iridescent-chrome")?.name).toBe("Iridescent Chrome");
    expect(getPresetById("non-existent-id")).toBeUndefined();
  });

  it("rejects invalid material parameters", () => {
    const valid = MATERIAL_PRESETS[0].parameters;
    expect(validateMaterialParameters({ ...valid, colorShift: -10 })).toBe(false);
    expect(validateMaterialParameters({ ...valid, colorShift: 150 })).toBe(false);
    expect(validateMaterialParameters({ ...valid, angle: 400 })).toBe(false);
    expect(
      validateMaterialParameters({
        ...valid,
        // @ts-expect-error intentional invalid runtime mode
        motionMode: "invalid-mode",
      }),
    ).toBe(false);
  });
});
