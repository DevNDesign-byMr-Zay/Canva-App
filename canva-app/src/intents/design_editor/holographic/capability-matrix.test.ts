import { describe, expect, it } from "vitest";
import {
  CANVA_CAPABILITY_MATRIX,
  getPropertyCapability,
  isNativeCanvaEdit,
} from "./capability-matrix";

describe("capability-matrix", () => {
  it("classifies native Canva editable properties", () => {
    expect(isNativeCanvaEdit("x")).toBe(true);
    expect(isNativeCanvaEdit("y")).toBe(true);
    expect(isNativeCanvaEdit("rotation")).toBe(true);
    expect(getPropertyCapability("x").tier).toBe("NATIVE_CANVA_EDIT");
  });

  it("classifies app-owned holographic properties", () => {
    for (const property of [
      "colorShift",
      "reflection",
      "glow",
      "grain",
      "angle",
      "transparency",
    ]) {
      expect(getPropertyCapability(property).tier).toBe("APP_OWNED_EFFECT");
      expect(getPropertyCapability(property).canvaSupported).toBe(true);
    }
    expect(getPropertyCapability("motionMode").tier).toBe("PREVIEW_ONLY");
  });

  it("classifies spatial properties as preview-only", () => {
    expect(getPropertyCapability("depth").tier).toBe("PREVIEW_ONLY");
    expect(getPropertyCapability("width").tier).toBe("PREVIEW_ONLY");
    expect(getPropertyCapability("height").tier).toBe("PREVIEW_ONLY");
  });

  it("fails unknown properties closed to preview-only", () => {
    const capability = getPropertyCapability("unknownProperty");
    expect(capability.tier).toBe("PREVIEW_ONLY");
    expect(capability.canvaSupported).toBe(false);
  });

  it("contains an explicit capability definition set", () => {
    expect(Object.keys(CANVA_CAPABILITY_MATRIX).length).toBeGreaterThanOrEqual(10);
  });
});
