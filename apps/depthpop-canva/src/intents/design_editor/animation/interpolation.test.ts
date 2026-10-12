import { describe, expect, it } from "vitest";
import { evaluateEasing, evaluateTrackValue } from "./interpolation";
import type { AnimationTrack } from "../scene/depth-scene";

describe("Animation interpolation", () => {
  it("evaluates easing curves correctly", () => {
    expect(evaluateEasing(0.5, "linear")).toBe(0.5);
    expect(evaluateEasing(0.5, "ease-in")).toBe(0.25);
    expect(evaluateEasing(0.5, "ease-out")).toBe(0.75);
    expect(evaluateEasing(0.25, "ease-in-out")).toBe(0.125);
  });

  it("evaluates track interpolation between keyframes", () => {
    const track: AnimationTrack = {
      id: "track-pos-x",
      property: "position.x",
      keyframes: [
        { timeMs: 0, value: 0, easing: "linear" },
        { timeMs: 1000, value: 10, easing: "linear" },
      ],
    };

    expect(evaluateTrackValue(track, -100, 0)).toBe(0);
    expect(evaluateTrackValue(track, 500, 0)).toBe(5);
    expect(evaluateTrackValue(track, 1500, 0)).toBe(10);
  });
});
