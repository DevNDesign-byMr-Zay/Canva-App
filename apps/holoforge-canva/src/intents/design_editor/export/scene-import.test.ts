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
