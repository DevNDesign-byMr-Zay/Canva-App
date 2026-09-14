import { describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  getCurrentPageMetadata: vi.fn(),
  getDesignMetadata: vi.fn(),
  openDesign: vi.fn(),
}));

import { canApplyScenario, type CanvaDesignSnapshot } from "./canva-design";

const fingerprint = "a".repeat(64);
const provenance = "b".repeat(64);
const optimization = "c".repeat(64);

const snapshot: CanvaDesignSnapshot = {
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1000, height: 800 },
  elements: [
    {
      id: "element-1",
      type: "shape",
      top: 10,
      left: 20,
      width: 100,
      height: 100,
      rotation: 0,
      locked: false,
    },
  ],
  fingerprint,
};

const scenario = {
  scenarioId: "scenario-1",
  source: { designId: "design-1", snapshotId: "snapshot-1", snapshotFingerprint: fingerprint },
  candidate: {
    changedElementIds: ["element-1"],
    layout: { elements: [{ elementId: "element-1", left: 40 }] },
  },
  evidence: { status: "complete", hardConstraintsPassed: true },
  presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
  provenance: { scenarioFingerprint: provenance, optimizationFingerprint: optimization },
};

describe("canApplyScenario", () => {
  it("accepts a verified scenario bound to the captured page fingerprint", () => {
    expect(canApplyScenario(scenario, snapshot)).toBe(true);
  });

  it("rejects stale snapshots", () => {
    expect(
      canApplyScenario(
        {
          ...scenario,
          source: { ...scenario.source, snapshotFingerprint: "d".repeat(64) },
        },
        snapshot,
      ),
    ).toBe(false);
  });

  it("rejects non-advisory or automatic scenarios", () => {
    expect(
      canApplyScenario(
        {
          ...scenario,
          presentation: { ...scenario.presentation, advisoryOnly: false },
        },
        snapshot,
      ),
    ).toBe(false);
    expect(
      canApplyScenario(
        {
          ...scenario,
          presentation: { ...scenario.presentation, autoApply: true },
        },
        snapshot,
      ),
    ).toBe(false);
  });

  it("rejects dimension edits that the current Canva GA element API cannot write", () => {
    expect(
      canApplyScenario(
        {
          ...scenario,
          candidate: {
            ...scenario.candidate,
            layout: { elements: [{ elementId: "element-1", width: 120 }] },
          },
        },
        snapshot,
      ),
    ).toBe(false);
  });

  it("rejects candidates whose declared change scope differs from their transforms", () => {
    expect(
      canApplyScenario(
        {
          ...scenario,
          candidate: { ...scenario.candidate, changedElementIds: ["element-1", "element-2"] },
        },
        snapshot,
      ),
    ).toBe(false);
  });
});
