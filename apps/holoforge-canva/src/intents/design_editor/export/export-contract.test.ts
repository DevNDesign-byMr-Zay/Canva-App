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

  it("builds a transparent static PNG request for the authored timeline frame", () => {
    const request = buildExportRequest(scene(), "png-still");

    expect(request).toMatchObject({
      format: "png-still",
      profile: "still-image",
      includeAnimation: false,
      resolution: { width: 1920, height: 1080 },
      transparentBackground: true,
    });
    expect(capabilityFor("png-still").execution).toBe("render-worker");
  });

  it("builds a bounded generic 45-view quilt request", () => {
    const request = buildExportRequest(scene(), "lightfield-quilt");

    expect(request).toMatchObject({
      format: "lightfield-quilt",
      profile: "lightfield-quilt",
      includeAnimation: false,
      resolution: { width: 3600, height: 3600 },
      transparentBackground: true,
      quilt: {
        columns: 5,
        rows: 9,
        views: 45,
        viewAspect: 1.8,
        viewConeDegrees: 40,
      },
    });
    expect(capabilityFor("lightfield-quilt").execution).toBe("render-worker");
  });

  it("allows an explicit custom quilt layout override", () => {
    const request = buildExportRequest(scene(), "lightfield-quilt", {
      resolution: { width: 1200, height: 800 },
      quilt: {
        columns: 3,
        rows: 2,
        views: 6,
        viewAspect: 1,
        viewConeDegrees: 30,
      },
    });

    expect(request.quilt?.views).toBe(6);
    expect(request.quilt?.viewConeDegrees).toBe(30);
  });

  it("serializes the actual HoloScene instead of a flattened preview recipe", () => {
    const parsed = JSON.parse(serializeHoloScene(scene()));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.objects).toHaveLength(1);
    expect(parsed.timeline.durationMs).toBeGreaterThan(0);
  });
});
