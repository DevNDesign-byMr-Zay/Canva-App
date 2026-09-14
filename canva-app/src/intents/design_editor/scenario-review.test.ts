import { describe, expect, it } from "vitest";

import { buildScenarioReview } from "./scenario-review";
import type { CanvaDesignSnapshot } from "./canva-design";
import type { HoloForgeScenario } from "./scenario-contract";

const snapshot: CanvaDesignSnapshot = {
  designId: "design-1",
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1000, height: 800 },
  elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 80, rotation: 5, locked: false }],
  fingerprint: "a".repeat(64),
};

const scenario: HoloForgeScenario = {
  contractVersion: 1,
  scenarioId: "scenario-1",
  source: { designId: "design-1", snapshotId: "snapshot-1", pageIds: ["page-1"], snapshotFingerprint: snapshot.fingerprint },
  intent: { summary: "Improve hierarchy", objectiveId: "hierarchy-v1", objectiveDirection: "maximize" },
  constraints: { hard: [], soft: [] },
  candidate: {
    changedElementIds: ["element-1"],
    layout: { elements: { "element-1": { x: 40, y: 30, rotation: 15 } } },
    delta: { "element-1": { x: 20 } },
  },
  evidence: {
    backend: "vaelon",
    algorithm: "deterministic-candidate-v1",
    seed: "seed-1",
    status: "complete",
    objectiveScore: 0.9,
    baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.8 },
    objectiveGap: 0.1,
    durationMs: 12,
    hardConstraintsPassed: true,
    warnings: [],
  },
  interpretation: { producer: "auren", label: "Hierarchy", summary: "Improve hierarchy", tradeoffs: [] },
  presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
  provenance: { scenarioFingerprint: "a".repeat(64), optimizationFingerprint: "b".repeat(64) },
};

describe("buildScenarioReview", () => {
  it("projects the same stable geometry semantics used by apply", () => {
    expect(buildScenarioReview(scenario, snapshot)).toEqual([{
      elementId: "element-1",
      before: { top: 10, left: 20, width: 100, height: 80, rotation: 5 },
      after: { top: 30, left: 40, width: 100, height: 80, rotation: 15 },
      changedFields: ["x", "y", "rotation"],
    }]);
  });

  it("omits candidates whose Canva element identity is absent", () => {
    const missing = structuredClone(scenario);
    missing.candidate.changedElementIds = ["missing"];
    missing.candidate.layout.elements = { missing: { x: 1 } };
    expect(buildScenarioReview(missing, snapshot)).toEqual([]);
  });

  it("refuses to preview transforms the stable SDK cannot write", () => {
    const unsupported = structuredClone(scenario);
    unsupported.candidate.layout.elements["element-1"] = { x: 40, width: 120, scale: 1.2 };
    expect(buildScenarioReview(unsupported, snapshot)).toEqual([]);
  });
});
