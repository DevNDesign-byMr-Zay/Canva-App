import { describe, expect, it } from "vitest";

import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  sha256,
  type HoloForgeScenario,
} from "./scenario-contract";
import {
  createApplyVerificationReceipt,
  projectExpectedPostApplyFingerprint,
  validateApplyVerificationReceiptForScenario,
  type VerificationDesignSnapshot,
} from "./apply-verification";

async function buildScenario(scenarioId: string): Promise<HoloForgeScenario> {
  const scenario = {
    contractVersion: 1 as const,
    scenarioId,
    source: {
      designId: "design-roundtrip",
      snapshotId: "snapshot-roundtrip",
      pageIds: ["page-1"],
      snapshotFingerprint: "",
    },
    intent: { summary: "Improve hierarchy", objectiveId: "hierarchy-v1", objectiveDirection: "maximize" as const },
    constraints: { hard: [], soft: [] },
    candidate: {
      changedElementIds: ["element-1"],
      layout: { elements: { "element-1": { x: 40, y: 30, rotation: 15 } } },
      delta: { "element-1": { x: 20, y: 20 } },
    },
    evidence: {
      backend: "vaelon",
      algorithm: "deterministic-candidate-v1",
      seed: "seed-roundtrip",
      status: "complete",
      objectiveScore: 0.9,
      baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.8 },
      objectiveGap: 0.1,
      durationMs: 12,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: { producer: "auren", label: "Hierarchy", summary: "Improve hierarchy", tradeoffs: [] },
    presentation: { advisoryOnly: true as const, autoApply: false as const, target: "web-dashboard" as const },
    provenance: { scenarioFingerprint: "", optimizationFingerprint: "" },
  } satisfies HoloForgeScenario;

  const snapshot: VerificationDesignSnapshot = {
    designId: scenario.source.designId,
    pageId: "page-1",
    pageDimensions: { width: 1000, height: 800 },
    elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 80, rotation: 5, locked: false }],
    fingerprint: "",
  };
  snapshot.fingerprint = await sha256({
    designId: snapshot.designId,
    pageId: snapshot.pageId,
    pageDimensions: snapshot.pageDimensions,
    elements: snapshot.elements,
  });
  scenario.source.snapshotFingerprint = snapshot.fingerprint;
  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);
  return scenario;
}

describe("AI scene/operator apply roundtrip integrity", () => {
  it("accepts a receipt only for the exact reviewed scenario", async () => {
    const scenario = await buildScenario("scenario-roundtrip-1");
    const snapshot: VerificationDesignSnapshot = {
      designId: scenario.source.designId,
      pageId: "page-1",
      pageDimensions: { width: 1000, height: 800 },
      elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 80, rotation: 5, locked: false }],
      fingerprint: scenario.source.snapshotFingerprint,
    };
    const expected = await projectExpectedPostApplyFingerprint(snapshot, scenario);
    const receipt = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: scenario.source.snapshotFingerprint,
      expectedFingerprint: expected,
      resultingFingerprint: expected,
      changedElementIds: scenario.candidate.changedElementIds,
    });
    expect(await validateApplyVerificationReceiptForScenario(receipt, scenario)).toBe(true);
  });

  it("rejects replaying an apply receipt against a different scenario identity", async () => {
    const scenario = await buildScenario("scenario-roundtrip-original");
    const snapshot: VerificationDesignSnapshot = {
      designId: scenario.source.designId,
      pageId: "page-1",
      pageDimensions: { width: 1000, height: 800 },
      elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 80, rotation: 5, locked: false }],
      fingerprint: scenario.source.snapshotFingerprint,
    };
    const expected = await projectExpectedPostApplyFingerprint(snapshot, scenario);
    const receipt = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: scenario.source.snapshotFingerprint,
      expectedFingerprint: expected,
      resultingFingerprint: expected,
      changedElementIds: scenario.candidate.changedElementIds,
    });
    const swappedScenario = await buildScenario("scenario-roundtrip-swapped");
    expect(await validateApplyVerificationReceiptForScenario(receipt, swappedScenario)).toBe(false);
  });

  it("rejects a post-apply result whose fingerprint diverges from the reviewed expectation", async () => {
    const scenario = await buildScenario("scenario-roundtrip-divergence");
    const snapshot: VerificationDesignSnapshot = {
      designId: scenario.source.designId,
      pageId: "page-1",
      pageDimensions: { width: 1000, height: 800 },
      elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 80, rotation: 5, locked: false }],
      fingerprint: scenario.source.snapshotFingerprint,
    };
    const expected = await projectExpectedPostApplyFingerprint(snapshot, scenario);
    const diverged = await sha256({ expected, unexpectedOperatorMutation: true });
    await expect(createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: scenario.source.snapshotFingerprint,
      expectedFingerprint: expected,
      resultingFingerprint: diverged,
      changedElementIds: scenario.candidate.changedElementIds,
    })).rejects.toThrow(/does not match/);
  });
});
