import { describe, expect, it } from "vitest";

import { createEffectPlan } from "../holographic/effect-plan";
import { createHoloScene } from "../scene/holo-scene";
import { serializeHoloScene } from "./export-contract";
import { parseHoloSceneJson } from "./scene-import";

function fixtureJson(): string {
  return serializeHoloScene(
    createHoloScene(
      createEffectPlan({
        creationType: "chrome",
        presetId: "iridescent-chrome",
      }),
    ),
  );
}

describe("HoloScene import", () => {
  it("round-trips an exported scene and freezes imported state", () => {
    const scene = parseHoloSceneJson(fixtureJson());

    expect(scene.schemaVersion).toBe(1);
    expect(scene.objects).toHaveLength(1);
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene.objects)).toBe(true);
    expect(Object.isFrozen(scene.objects[0]?.material)).toBe(true);
  });

  it("restores authored multi-object camera environment and keyframe state", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.objects[0].animationPreset = "custom";
    parsed.objects[0].animationTracks = [
      {
        id: "position-track",
        property: "position",
        keyframes: [
          {
            id: "pose-0",
            timeMs: 0,
            value: { x: 0, y: 0, z: 0 },
            easing: "ease-in-out",
          },
          {
            id: "pose-1",
            timeMs: 3000,
            value: { x: 1.2, y: -0.4, z: 0.8 },
            easing: "ease-in-out",
          },
        ],
      },
    ];
    parsed.objects.push({
      ...parsed.objects[0],
      id: "second-object",
      name: "SECOND",
      animationTracks: [],
      transform: {
        position: { x: -0.75, y: 0.25, z: 0.3 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 },
        scale: { x: 0.8, y: 0.8, z: 0.8 },
      },
    });
    parsed.camera.position = { x: 2.25, y: 1.25, z: 4.65 };
    parsed.camera.target = { x: 0.1, y: 0.2, z: 0 };
    parsed.camera.fov = 38;
    parsed.environment = {
      ...parsed.environment,
      background: "#101827",
      ambientIntensity: 1.25,
      keyLightIntensity: 3.5,
      rimLightIntensity: 2.4,
      floorGrid: false,
    };
    parsed.timeline.currentTimeMs = 3000;

    const restored = parseHoloSceneJson(JSON.stringify(parsed));

    expect(restored.objects).toHaveLength(2);
    expect(restored.objects[0]?.animationTracks[0]?.keyframes[1]?.value.x).toBe(1.2);
    expect(restored.objects[1]?.transform.position.x).toBe(-0.75);
    expect(restored.camera.position).toEqual({ x: 2.25, y: 1.25, z: 4.65 });
    expect(restored.camera.fov).toBe(38);
    expect(restored.environment.background).toBe("#101827");
    expect(restored.environment.floorGrid).toBe(false);
    expect(restored.timeline.currentTimeMs).toBe(3000);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseHoloSceneJson("{not-json")).toThrow(
      /not valid JSON/i,
    );
  });

  it("rejects a non-HoloScene payload", () => {
    expect(() =>
      parseHoloSceneJson(JSON.stringify({ schemaVersion: 1, id: "fake" })),
    ).toThrow(/does not match the HoloScene v1 structure/i);
  });

  it("rejects remote source URLs so reopened projects stay self-contained", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.source.previewUrl = "https://example.com/source.png";
    parsed.objects[0].geometry.sourceUrl = "https://example.com/source.png";

    expect(() => parseHoloSceneJson(JSON.stringify(parsed))).toThrow(
      /does not match the HoloScene v1 structure/i,
    );
  });

  it("rejects external mesh URLs from imported projects", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.objects[0].geometry.meshUrl = "https://example.com/model.glb";

    expect(() => parseHoloSceneJson(JSON.stringify(parsed))).toThrow(
      /does not match the HoloScene v1 structure/i,
    );
  });

  it("rejects unsafe camera and transform values", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.camera.near = -1;
    parsed.camera.far = 0;
    parsed.objects[0].transform.scale.x = 0;

    expect(() => parseHoloSceneJson(JSON.stringify(parsed))).toThrow(
      /does not match the HoloScene v1 structure/i,
    );
  });

  it("rejects material values outside the renderer contract", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.objects[0].material.opacity = 3;
    parsed.objects[0].material.ior = 99;

    expect(() => parseHoloSceneJson(JSON.stringify(parsed))).toThrow(
      /does not match the HoloScene v1 structure/i,
    );
  });

  it("rejects duplicate object ids through semantic validation", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.objects.push({
      ...parsed.objects[0],
      name: "Duplicate",
    });

    expect(() => parseHoloSceneJson(JSON.stringify(parsed))).toThrow(
      /duplicate object id/i,
    );
  });

  it("rejects keyframes outside the imported timeline", () => {
    const parsed = JSON.parse(fixtureJson());
    parsed.objects[0].animationPreset = "custom";
    parsed.objects[0].animationTracks = [
      {
        id: "position-track",
        property: "position",
        keyframes: [
          {
            id: "late",
            timeMs: parsed.timeline.durationMs + 1,
            value: { x: 0, y: 0, z: 0 },
            easing: "linear",
          },
        ],
      },
    ];

    expect(() => parseHoloSceneJson(JSON.stringify(parsed))).toThrow(
      /outside the timeline/i,
    );
  });
});
