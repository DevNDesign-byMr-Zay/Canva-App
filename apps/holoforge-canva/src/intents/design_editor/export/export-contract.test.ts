import { describe, expect, it } from "vitest";
import { createEffectPlan } from "../holographic/effect-plan";
import { createHoloScene } from "../scene/holo-scene";
import {
  EXPORT_CAPABILITIES,
  buildExportRequest,
  capabilityFor,
  serializeHoloScene,
} from "./export-contract";

function scene() {
  return createHoloScene(
    createEffectPlan({
      creationType: "chrome",
      presetId: "iridescent-chrome",
    }),
  );
}

describe("HoloForge export contract", () => {
  it("exposes only the scene snapshot as client-ready in this batch", () => {
    const ready = EXPORT_CAPABILITIES.filter((item) => item.ready);
    expect(ready.map((item) => item.format)).toEqual(["scene-json"]);
    expect(ready[0]?.execution).toBe("client");
  });

  it("builds a versioned GLB worker request without pretending the client export is ready", () => {
    const request = buildExportRequest(scene(), "glb");
    expect(request).toMatchObject({
      schemaVersion: 1,
      format: "glb",
      profile: "generic-3d",
      includeAnimation: true,
      transparentBackground: false,
    });
    expect(capabilityFor("glb").ready).toBe(false);
    expect(capabilityFor("glb").execution).toBe("render-worker");
  });

  it("requires an explicit device layout for light-field quilt output", () => {
    expect(() => buildExportRequest(scene(), "lightfield-quilt")).toThrow(
      /explicit device\/profile layout/i,
    );

    expect(
      buildExportRequest(scene(), "lightfield-quilt", {
        quilt: { columns: 5, rows: 9, views: 45, viewAspect: 1.6 },
      }).quilt,
    ).toEqual({ columns: 5, rows: 9, views: 45, viewAspect: 1.6 });
  });

  it("serializes the actual HoloScene instead of a flattened preview recipe", () => {
    const parsed = JSON.parse(serializeHoloScene(scene()));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.objects).toHaveLength(1);
    expect(parsed.timeline.durationMs).toBeGreaterThan(0);
  });
});
