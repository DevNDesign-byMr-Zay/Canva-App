import { describe, expect, it } from "vitest";
import type { HoloScene } from "../scene/holo-scene";
import { serializeHoloScene } from "./export-contract";
import { parseHoloSceneJson } from "./scene-import";
import {
  preparePortableHoloScene,
  sceneDownloadName,
} from "./scene-download";

function portableScene(): HoloScene {
  return {
    schemaVersion: 1,
    id: "HF Scene / Gold",
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
      ambientIntensity: 0.68,
      keyLightIntensity: 2.15,
      rimLightIntensity: 1.65,
      floorGrid: true,
    },
    camera: {
      position: { x: 0, y: 0.35, z: 4.3 },
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

describe("HoloScene download", () => {
  it("creates a stable portable scene filename", () => {
    expect(sceneDownloadName(portableScene())).toBe(
      "HF-Scene-Gold.holoscene.json",
    );
  });

  it("stores a shared embedded raster once and restores it on project open", async () => {
    const scene = portableScene();
    const prepared = await preparePortableHoloScene(scene);

    expect(prepared.source.previewUrl).toBe("data:image/png;base64,AAAA");
    expect(prepared.objects[0]?.geometry.sourceUrl).toBeUndefined();

    const reopened = parseHoloSceneJson(serializeHoloScene(prepared));
    expect(reopened.source.previewUrl).toBe("data:image/png;base64,AAAA");
    expect(reopened.objects[0]?.geometry.sourceUrl).toBe(
      "data:image/png;base64,AAAA",
    );
  });
});
