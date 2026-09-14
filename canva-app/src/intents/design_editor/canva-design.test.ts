import { describe, expect, it } from "vitest";

import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  hasCanonicalProvenance,
  type HoloForgeScenario,
} from "./scenario-contract";

const fingerprint = "a".repeat(64);

function buildScenario(): HoloForgeScenario {
  return {
    contractVersion: 1,
    scenarioId: "scenario-1",
    source: { designId: "design-1", snapshotId: "snapshot-1", pageIds: ["page-1"], snapshotFingerprint: fingerprint },
    intent: { summary: "Improve hierarchy", objectiveId: "hierarchy-v1", objectiveDirection: "maximize" },
    constraints: { hard: [{ id: "keep-element", elementId: "element-1" }], soft: [{ id: "spacing", weight: 0.4 }] },
    candidate: {
      changedElementIds: ["element-1"],
      layout: { elements: { "element-1": { x: 40, y: 20 } } },
      delta: { "element-1": { x: 20 } },
    },
    evidence: {
      backend: "vaelon",
      algorithm: "deterministic-candidate-v1",
      seed: "seed-1",
      status: "complete",
      objectiveScore: 0.9,
      baseline: { backend: "classical-reference", algorithm: "exact-reference-v1", objectiveScore: 0.95 },
      objectiveGap: 0.05,
      durationMs: 12,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: { producer: "auren", label: "Hierarchy", summary: "Improve hierarchy", tradeoffs: [] },
    presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
    provenance: { scenarioFingerprint: "", optimizationFingerprint: "" },
  };
}

async function signedScenario(): Promise<HoloForgeScenario> {
  const scenario = buildScenario();
  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);
  return scenario;
}

describe("canonical scenario provenance", () => {
  it("accepts a correctly signed canonical scenario", async () => {
    expect(await hasCanonicalProvenance(await signedScenario())).toBe(true);
  });

  it("rejects tampered evidence", async () => {
    const scenario = await signedScenario();
    scenario.evidence.objectiveScore = 0.1;
    expect(await hasCanonicalProvenance(scenario)).toBe(false);
  });

  it("rejects a tampered optimization input", async () => {
    const scenario = await signedScenario();
    scenario.constraints.soft = [{ id: "spacing", weight: 0.9 }];
    expect(await hasCanonicalProvenance(scenario)).toBe(false);
  });

  it("rejects missing or malformed fingerprints", async () => {
    const scenario = buildScenario();
    expect(await hasCanonicalProvenance(scenario)).toBe(false);
    scenario.provenance.scenarioFingerprint = "not-a-sha256";
    scenario.provenance.optimizationFingerprint = "b".repeat(64);
    expect(await hasCanonicalProvenance(scenario)).toBe(false);
  });
});
