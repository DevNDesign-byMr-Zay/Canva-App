import { describe, expect, it } from "vitest";

import { canApplyScenario, type CanvaDesignSnapshot } from "./canva-design";

const fingerprint = "a".repeat(64);
const provenance = "b".repeat(64);
const optimization = "c".repeat(64);

const snapshot: CanvaDesignSnapshot = {
  designId: "design-1",
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1000, height: 800 },
  elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 100, rotation: 0, locked: false }],
  fingerprint,
};

const scenario = {
  scenarioId: "scenario-1",
  source: { designId: "design-1", snapshotId: "snapshot-1", snapshotFingerprint: fingerprint },
  candidate: { changedElementIds: ["element-1"], layout: { elements: [{ elementId: "element-1", left: 40 }] } },
  evidence: { status: "complete", hardConstraintsPassed: true },
  presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
  provenance: { scenarioFingerprint: provenance, optimizationFingerprint: optimization },
};

describe("canApplyScenario", () => {
  it("accepts a verified scenario bound to the current design", () => {
    expect(canApplyScenario(scenario, snapshot)).toBe(true);
  });

  it("rejects a scenario when the Canva design identity is not trusted", () => {
    expect(canApplyScenario(scenario, { ...snapshot, designId: undefined })).toBe(false);
  });

  it("rejects a scenario from another Canva design", () => {
    expect(canApplyScenario({ ...scenario, source: { ...scenario.source, designId: "design-2" } }, snapshot)).toBe(false);
  });

  it("rejects stale snapshots", () => {
    expect(canApplyScenario({ ...scenario, source: { ...scenario.source, snapshotFingerprint: "d".repeat(64) } }, snapshot)).toBe(false);
  });

  it("rejects non-advisory or automatic scenarios", () => {
    expect(canApplyScenario({ ...scenario, presentation: { ...scenario.presentation, advisoryOnly: false } }, snapshot)).toBe(false);
    expect(canApplyScenario({ ...scenario, presentation: { ...scenario.presentation, autoApply: true } }, snapshot)).toBe(false);
  });
});
