import { describe, expect, it } from "vitest";

import { samplePresetMotion } from "./preset-motion";

describe("HoloForge preset motion", () => {
  it("matches the turntable angular rate", () => {
    expect(samplePresetMotion("turntable", 6).rotation.y).toBeCloseTo(3, 8);
  });

  it("matches the sweep angular rate", () => {
    expect(samplePresetMotion("sweep", 6).rotation.y).toBeCloseTo(2.04, 8);
  });

  it("matches the pulse amplitude", () => {
    const motion = samplePresetMotion("pulse", Math.PI / 4.8);
    expect(motion.scale.x).toBeCloseTo(1.045, 6);
    expect(motion.scale.y).toBeCloseTo(motion.scale.x, 8);
    expect(motion.scale.z).toBeCloseTo(motion.scale.x, 8);
  });

  it("matches the orbit ellipse", () => {
    expect(samplePresetMotion("orbit", 0).position.x).toBeCloseTo(0.32, 8);
    expect(samplePresetMotion("orbit", 0).position.z).toBeCloseTo(0, 8);

    const quarter = samplePresetMotion("orbit", Math.PI / (2 * 0.55));
    expect(quarter.position.x).toBeCloseTo(0, 8);
    expect(quarter.position.z).toBeCloseTo(0.18, 8);
  });

  it("keeps a paused scene sample deterministic because time is the only input", () => {
    const a = samplePresetMotion("shimmer", 2.4);
    const b = samplePresetMotion("shimmer", 2.4);
    expect(a).toEqual(b);
  });

  it("keeps static/custom motion neutral", () => {
    expect(samplePresetMotion("static", 4)).toEqual({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(samplePresetMotion("custom", 4)).toEqual({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  });
});
