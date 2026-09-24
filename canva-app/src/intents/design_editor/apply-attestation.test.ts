import { describe, expect, it } from "vitest";

import { createApplyAttestation, validateApplyAttestation } from "./apply-attestation";
import {
  createApplyVerificationReceipt,
  projectExpectedPostApplyFingerprint,
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
    designId: "design-attest-1",
    pageId: "page-attest-1",
    pageDimensions: { width: 1200, height: 900 },
    elements: [
      {
        id: "element-1",
        type: "text",
        top: 10,
        left: 20,
        width: 120,
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
    scenarioId: "scenario-attest-1",
    source: {
      designId: snapshot.designId!,
      snapshotId: "snapshot-attest-1",
      pageIds: [snapshot.pageId],
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
      layout: { elements: { "element-1": { x: 80, y: 60, rotation: 4 } } },
      delta: { "element-1": { x: 60, y: 50, rotation: 4 } },
    },
    evidence: {
      backend: "vaelon",
      algorithm: "deterministic-candidate-v1",
      seed: "attest-seed-1",
      status: "complete",
      objectiveScore: 0.91,
      baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.8 },
      objectiveGap: 0.11,
      durationMs: 10,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: "auren",
      label: "Hierarchy",
      summary: "Improve hierarchy",
      tradeoffs: [],
    },
    presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
    provenance: { scenarioFingerprint: "", optimizationFingerprint: "" },
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

describe("reviewed Canva apply attestation", () => {
  it("seals scenario, reviewed source, receipt, and post-state into one immutable proof", async () => {
    const { snapshot, scenario, receipt } = await fixture();
    const attestation = await createApplyAttestation({ scenario, snapshot, receipt });

    expect(await validateApplyAttestation(attestation, { scenario, snapshot, receipt })).toBe(true);
    expect(attestation.attestationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(attestation.receiptFingerprint).toBe(receipt.receiptFingerprint);
    expect(attestation.sourceFingerprint).toBe(snapshot.fingerprint);
    expect(attestation.resultingFingerprint).toBe(receipt.resultingFingerprint);
    expect(Object.isFrozen(attestation)).toBe(true);
    expect(Object.isFrozen(attestation.changedElementIds)).toBe(true);
    expect(Object.isFrozen(attestation.safety)).toBe(true);
  });

  it("rejects a valid receipt replayed against another reviewed scenario", async () => {
    const { snapshot, scenario, receipt } = await fixture();
    const attestation = await createApplyAttestation({ scenario, snapshot, receipt });
    const substitute = structuredClone(scenario);
    substitute.scenarioId = "scenario-attest-2";
    substitute.provenance.optimizationFingerprint =
      await computeOptimizationFingerprint(substitute);
    substitute.provenance.scenarioFingerprint = await computeScenarioFingerprint(substitute);

    expect(
      await validateApplyAttestation(attestation, { scenario: substitute, snapshot, receipt }),
    ).toBe(false);
  });

  it("rejects reviewed snapshot substitution and post-state identity tampering", async () => {
    const { snapshot, scenario, receipt } = await fixture();
    const attestation = await createApplyAttestation({ scenario, snapshot, receipt });
    const substituteSnapshot = structuredClone(snapshot);
    substituteSnapshot.pageId = "page-attest-2";
    substituteSnapshot.fingerprint = await sha256({
      designId: substituteSnapshot.designId,
      pageId: substituteSnapshot.pageId,
      pageDimensions: substituteSnapshot.pageDimensions,
      elements: substituteSnapshot.elements,
    });

    expect(
      await validateApplyAttestation(attestation, {
        scenario,
        snapshot: substituteSnapshot,
        receipt,
      }),
    ).toBe(false);
    expect(
      await validateApplyAttestation(
        { ...attestation, resultingFingerprint: "f".repeat(64) },
        { scenario, snapshot, receipt },
      ),
    ).toBe(false);
  });

  it("rejects widened authority and deceptive accessors without executing getters", async () => {
    const { snapshot, scenario, receipt } = await fixture();
    const attestation = await createApplyAttestation({ scenario, snapshot, receipt });

    expect(
      await validateApplyAttestation(
        { ...attestation, safety: { ...attestation.safety, authoritative: true } },
        { scenario, snapshot, receipt },
      ),
    ).toBe(false);

    let getterReads = 0;
    const accessorAttestation = { ...attestation };
    Object.defineProperty(accessorAttestation, "attestationFingerprint", {
      enumerable: true,
      get() {
        getterReads += 1;
        return attestation.attestationFingerprint;
      },
    });
    expect(
      await validateApplyAttestation(accessorAttestation, { scenario, snapshot, receipt }),
    ).toBe(false);
    expect(getterReads).toBe(0);
  });
});
