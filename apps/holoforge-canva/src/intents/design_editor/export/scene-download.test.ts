import { describe, expect, it } from "vitest";
import type { HoloScene } from "../scene/holo-scene";
import {
  preparePortableHoloScene,
  sceneDownloadName,
} from "./scene-download";

describe("HoloScene project download", () => {
  it("creates a stable portable scene filename", () => {
    expect(sceneDownloadName({ id: "HF Scene / Gold" } as HoloScene)).toBe(
      "HF-Scene-Gold.holoscene.json",
    );
  });

  it("keeps already embedded image assets portable", async () => {
    const dataUrl = "data:image/png;base64,AAAA";
    const scene = {
      schemaVersion: 1,
      id: "portable-scene",
      source: { type: "raster", previewUrl: dataUrl },
      objects: [
        {
          id: "object-1",
          name: "Logo",
          creationType: "holo_logo",
          geometry: {
            type: "plane",
            sourceUrl: dataUrl,
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
    } as const satisfies HoloScene;

    const portable = await preparePortableHoloScene(scene);

    expect(portable.source.previewUrl).toBe(dataUrl);
    expect(portable.objects[0]?.geometry.sourceUrl).toBe(dataUrl);
  });
});
