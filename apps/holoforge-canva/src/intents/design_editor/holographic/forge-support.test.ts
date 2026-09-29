import { describe, expect, it } from "vitest";
import { getCreationForgeSupport } from "./forge-support";

describe("creation forge support", () => {
  it("enables app-owned material creation types", () => {
    for (const creationType of ["holo_graphic", "glass", "chrome", "light_fx"] as const) {
      expect(getCreationForgeSupport(creationType)).toMatchObject({
        route: "APP_OWNED_EFFECT",
        forgeable: true,
      });
    }
  });

  it("keeps text and logo fail-closed until source binding exists", () => {
    expect(getCreationForgeSupport("holo_text")).toMatchObject({
      route: "PREVIEW_ONLY",
      forgeable: false,
    });
    expect(getCreationForgeSupport("holo_logo")).toMatchObject({
      route: "PREVIEW_ONLY",
      forgeable: false,
    });
  });
});
