import { describe, expect, it } from "vitest";

import type { CanvaDesignSnapshot } from "./canva-design";
import { runPlacementExperiment } from "./placement-experiment";

const snapshot: CanvaDesignSnapshot = {
  designId: "design-placement-1",
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1000, height: 800 },
  elements: [
    {
      id: "a",
      type: "shape",
      top: 100,
      left: 100,
      width: 100,
      height: 100,
      rotation: 0,
      locked: false,
    },
    {
      id: "b",
      type: "shape",
      top: 100,
      left: 700,
      width: 100,
      height: 100,
      rotation: 0,
      locked: false,
    },
    {
      id: "brand",
      type: "image",
      top: 20,
      left: 850,
      width: 100,
      height: 60,
      rotation: 0,
      locked: true,
    },
  ],
  fingerprint: "a".repeat(64),
};

const slots = [
  { slotId: "left", x: 120, y: 120 },
  { slotId: "right", x: 680, y: 120 },
];

describe("placement experiment", () => {
  it("compares an exact classical reference with deterministic VÆLON candidate evidence", () => {
    const first = runPlacementExperiment({
      snapshot,
      elementIds: ["a", "b"],
      slots,
    });
    const second = runPlacementExperiment({
      snapshot: structuredClone(snapshot),
      elementIds: ["a", "b"],
      slots: structuredClone(slots),
    });

    expect(first).toEqual(second);
    expect(first.classical.backend).toBe("classical-reference");
    expect(first.classical.algorithm).toBe("exact-enumeration-v1");
    expect(first.candidate.backend).toBe("vaelon");
    expect(first.candidate.algorithm).toBe("deterministic-binary-local-search-v1");
    expect(first.objectiveGap).toBeGreaterThanOrEqual(0);
    expect(first.comparison).toBe("observational-only");
    expect(first.safety).toEqual({ autoApply: false, authoritative: false });
  });

  it("uses the classical result as a correctness floor without assuming candidate superiority", () => {
    const result = runPlacementExperiment({
      snapshot,
      elementIds: ["a", "b"],
      slots,
    });

    expect(result.candidate.objectiveScore).toBeGreaterThanOrEqual(result.classical.objectiveScore);
    expect(result.objectiveGap).toBe(
      Number((result.candidate.objectiveScore - result.classical.objectiveScore).toFixed(9)),
    );
  });

  it("refuses locked elements, missing elements, duplicate ids, and mismatched slot counts", () => {
    expect(() =>
      runPlacementExperiment({
        snapshot,
        elementIds: ["brand"],
        slots: [{ slotId: "brand-slot", x: 850, y: 20 }],
      }),
    ).toThrow(/locked element/);

    expect(() =>
      runPlacementExperiment({
        snapshot,
        elementIds: ["missing"],
        slots: [{ slotId: "slot", x: 1, y: 1 }],
      }),
    ).toThrow(/element not found/);

    expect(() =>
      runPlacementExperiment({
        snapshot,
        elementIds: ["a", "a"],
        slots,
      }),
    ).toThrow(/unique/);

    expect(() =>
      runPlacementExperiment({
        snapshot,
        elementIds: ["a"],
        slots,
      }),
    ).toThrow(/slots must match/);
  });

  it("rejects non-finite placement evidence before comparison", () => {
    expect(() =>
      runPlacementExperiment({
        snapshot,
        elementIds: ["a"],
        slots: [{ slotId: "bad", x: Number.NaN, y: 0 }],
      }),
    ).toThrow(/finite/);
  });
});
