import { describe, expect, it, vi } from "vitest";

vi.mock("@canva/user", () => ({
  auth: {
    getCanvaUserToken: vi.fn(async () => "test-token"),
  },
}));

import {
  backendOrigin,
  isWorkerExportImplemented,
  prepareSceneForBackend,
} from "./export-client";
import type { HoloScene } from "../scene/holo-scene";

function scene(): HoloScene {
  return {
    schemaVersion: 1,
    id: "scene-test",
    source: {
      type: "raster",
      previewUrl: "data:image/png;base64,AAAA",
    },
    objects: [
      {
        id: "object-1",
        name: "Logo",
        creationType: "holo_logo",
        geometry: {
          type: "plane",
          sourceUrl: "data:image/png;base64,AAAA",
          thickness: 0.1,
          bevelSize: 0.01,
          bevelSegments: 2,
        },
        material: {
          family: "iridescent",
          baseColor: "#5cecff",
          opacity: 1,
          metalness: 0.3,
          roughness: 0.2,
          transmission: 0,
          ior: 1.3,
          emissionColor: "#9c73ff",
          emissionStrength: 0.5,
          spectralShift: 70,
          diffraction: 0.4,
          scanlineStrength: 0.3,
          shimmerStrength: 0.6,
          reflectionStrength: 80,
        },
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        animationPreset: "static",
        animationTracks: [],
        visible: true,
      },
    ],
    environment: {
      background: "#020307",
      ambientIntensity: 0.5,
      keyLightIntensity: 2,
      rimLightIntensity: 1.5,
      floorGrid: true,
    },
    camera: {
      position: { x: 0, y: 0.3, z: 4 },
      target: { x: 0, y: 0, z: 0 },
      fov: 42,
      near: 0.05,
      far: 100,
    },
    timeline: {
      durationMs: 6000,
      fps: 30,
      currentTimeMs: 0,
      playing: false,
    },
    exportProfile: "generic-3d",
  };
}

describe("HoloForge export client", () => {
  it("reports only actually implemented worker formats", () => {
    expect(isWorkerExportImplemented("glb")).toBe(true);
    expect(isWorkerExportImplemented("gltf")).toBe(true);
    expect(isWorkerExportImplemented("webm-alpha")).toBe(true);
    expect(isWorkerExportImplemented("mp4")).toBe(true);
    expect(isWorkerExportImplemented("png-sequence")).toBe(true);
    expect(isWorkerExportImplemented("usdz")).toBe(false);
    expect(isWorkerExportImplemented("lightfield-quilt")).toBe(false);
  });

  it("keeps embedded image sources portable without network access", async () => {
    const portable = await prepareSceneForBackend(scene());
    expect(portable.source.previewUrl).toBe("data:image/png;base64,AAAA");
    expect(portable.objects[0]?.geometry.sourceUrl).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("does not invent a backend host when Canva has not injected one", () => {
    expect(backendOrigin()).toBe("");
  });
});
