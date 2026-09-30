import { describe, expect, it } from "vitest";
import { getCreationForgeSupport } from "./forge-support";

describe("creation forge support", () => {
  it("exposes every creation type as a real forge capability", () => {
    for (const creationType of [
      "holo_text",
      "holo_logo",
      "holo_graphic",
      "glass",
      "chrome",
      "light_fx",
    ] as const) {
      expect(getCreationForgeSupport(creationType).forgeable).toBe(true);
    }
  });

  it("defines the source requirement and route for text and logo", () => {
    expect(getCreationForgeSupport("holo_text")).toMatchObject({
      route: "APP_OWNED_EFFECT",
      requiredSource: "text",
    });
    expect(getCreationForgeSupport("holo_logo")).toMatchObject({
      route: "DERIVED_IMAGE",
      requiredSource: "image",
    });
  });

  it("keeps Holo Graphic hybrid so it works with or without a source image", () => {
    expect(getCreationForgeSupport("holo_graphic")).toMatchObject({
      route: "HYBRID",
      requiredSource: "none",
    });
  });
});
