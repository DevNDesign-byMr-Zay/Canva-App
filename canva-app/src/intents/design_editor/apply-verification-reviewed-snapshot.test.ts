import { describe, expect, it } from "vitest";

import {
  createApplyVerificationReceipt,
  projectExpectedPostApplyFingerprint,
  validateApplyVerificationReceiptForReviewedSnapshot,
  type VerificationDesignSnapshot,
} from "./apply-verification";
import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  sha256,
  type HoloForgeScenario,
} from "./scenario-contract";

async function fixture() {
  const snapshot: VerificationDesignSnapshot = {
    designId: "design-1",
    pageId: "page-1",
    pageDimensions: { width: 1000, height: 800 },
    elements: [
      {
        id: "element-1",
        type: "text",
        top: 10,
        left: 20,
        width: 100,
        height: 40,
        rotation: 0,
        locked: false,
      },
    ],
    fingerprint: "",
  };
  snapshot.fingerprint = await sha256({
    designId: snapshot.designId,
    pageId: snapshot.pageId,
    pageDimensions: snapshot.pageDimensions,
    elements: snapshot.elements,
  });

  const scenario: HoloForgeScenario = {
    contractVersion: 1,
    scenarioId: "scenario-reviewed-receipt-1",
    source: {
      designId: "design-1",
      snapshotId: "snapshot-1",
      pageIds: ["page-1"],
      snapshotFingerprint: snapshot.fingerprint,
    },
    intent: {
      summary: "Improve hierarchy",
      objectiveId: "hierarchy-v1",
      objectiveDirection: "maximize",
    },
    constraints: { hard: [], soft: [] },
    candidate: {
      changedElementIds: ["element-1"],
      layout: { elements: { "element-1": { x: 40, y: 30, rotation: 10 } } },
      delta: { "element-1": { x: 20, y: 20, rotation: 10 } },
    },
    evidence: {
      backend: "vaelon",
      algorithm: "deterministic-candidate-v1",
      seed: "seed-1",
      status: "complete",
      objectiveScore: 0.9,
      baseline: {
        backend: "reference",
        algorithm: "exact-v1",
        objectiveScore: 0.8,
      },
      objectiveGap: 0.1,
      durationMs: 12,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: "auren",
      label: "Hierarchy",
      summary: "Improve hierarchy",
      tradeoffs: [],
    },
    presentation: {
      advisoryOnly: true,
      autoApply: false,
      target: "web-dashboard",
    },
    provenance: {
      scenarioFingerprint: "",
      optimizationFingerprint: "",
    },
  };
  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);

  const expectedFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);
  const receipt = await createApplyVerificationReceipt({
    scenario,
    sourceFingerprint: snapshot.fingerprint,
    expectedFingerprint,
    resultingFingerprint: expectedFingerprint,
    changedElementIds: scenario.candidate.changedElementIds,
  });

  return { snapshot, scenario, receipt };
}

describe("reviewed snapshot receipt lineage", () => {
  it("accepts only the exact reviewed snapshot and projected post-state", async () => {
    const { snapshot, scenario, receipt } = await fixture();

    expect(
      await validateApplyVerificationReceiptForReviewedSnapshot(receipt, scenario, snapshot),
    ).toBe(true);

    const driftedGeometry = structuredClone(snapshot);
    driftedGeometry.elements[0].left = 999;
    expect(
      await validateApplyVerificationReceiptForReviewedSnapshot(receipt, scenario, driftedGeometry),
    ).toBe(false);

    const wrongPage = structuredClone(snapshot);
    wrongPage.pageId = "page-2";
    wrongPage.fingerprint = await sha256({
      designId: wrongPage.designId,
      pageId: wrongPage.pageId,
      pageDimensions: wrongPage.pageDimensions,
      elements: wrongPage.elements,
    });
    expect(
      await validateApplyVerificationReceiptForReviewedSnapshot(receipt, scenario, wrongPage),
    ).toBe(false);

    const changedScenario = structuredClone(scenario);
    changedScenario.candidate.layout.elements["element-1"] = {
      x: 60,
      y: 30,
      rotation: 10,
    };
    changedScenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(changedScenario);
    changedScenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(changedScenario);
    expect(
      await validateApplyVerificationReceiptForReviewedSnapshot(receipt, changedScenario, snapshot),
    ).toBe(false);
  });
});
