import { describe, expect, it } from "vitest";

import {
  createApplyVerificationReceipt,
  projectExpectedPostApplyFingerprint,
  validateApplyVerificationReceipt,
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
      {
        id: "element-2",
        type: "shape",
        top: 100,
        left: 120,
        width: 80,
        height: 80,
        rotation: 5,
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
    scenarioId: "scenario-apply-1",
    source: {
      designId: "design-1",
      snapshotId: "snapshot-1",
      pageIds: ["page-1"],
      snapshotFingerprint: snapshot.fingerprint,
    },
    intent: { summary: "Improve hierarchy", objectiveId: "hierarchy-v1", objectiveDirection: "maximize" },
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
      baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.8 },
      objectiveGap: 0.1,
      durationMs: 12,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: { producer: "auren", label: "Hierarchy", summary: "Improve hierarchy", tradeoffs: [] },
    presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
    provenance: {
      scenarioFingerprint: "",
      optimizationFingerprint: "",
    },
  };

  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);

  return { snapshot, scenario };
}

describe("HoloForge post-apply evidence", () => {
  it("projects the exact writable post-state without mutating the reviewed snapshot", async () => {
    const { snapshot, scenario } = await fixture();
    const before = structuredClone(snapshot);

    const expected = await projectExpectedPostApplyFingerprint(snapshot, scenario);
    const manual = await sha256({
      designId: snapshot.designId,
      pageId: snapshot.pageId,
      pageDimensions: snapshot.pageDimensions,
      elements: [
        { ...snapshot.elements[0], left: 40, top: 30, rotation: 10 },
        snapshot.elements[1],
      ],
    });

    expect(expected).toBe(manual);
    expect(snapshot).toEqual(before);
  });

  it("fails closed when a candidate requests a transform Canva cannot stably write", async () => {
    const { snapshot, scenario } = await fixture();
    scenario.candidate.layout.elements["element-1"] = { width: 200 };

    await expect(projectExpectedPostApplyFingerprint(snapshot, scenario)).rejects.toThrow(
      /cannot be projected/,
    );
  });

  it("creates deterministic immutable evidence only when live and expected post-state match", async () => {
    const { snapshot, scenario } = await fixture();
    const expectedFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);

    const first = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: snapshot.fingerprint,
      expectedFingerprint,
      resultingFingerprint: expectedFingerprint,
      changedElementIds: scenario.candidate.changedElementIds,
    });
    const second = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: snapshot.fingerprint,
      expectedFingerprint,
      resultingFingerprint: expectedFingerprint,
      changedElementIds: scenario.candidate.changedElementIds,
    });

    expect(first.receiptFingerprint).toBe(second.receiptFingerprint);
    expect(await validateApplyVerificationReceipt(first)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.changedElementIds)).toBe(true);
    expect(Object.isFrozen(first.safety)).toBe(true);
    expect(first.safety).toEqual({
      explicitUserApply: true,
      autoApply: false,
      authoritative: false,
      physicalActuation: false,
    });
  });

  it("rejects a receipt whose changed-element scope diverges from the scenario", async () => {
    const { snapshot, scenario } = await fixture();
    const expectedFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);

    await expect(
      createApplyVerificationReceipt({
        scenario,
        sourceFingerprint: snapshot.fingerprint,
        expectedFingerprint,
        resultingFingerprint: expectedFingerprint,
        changedElementIds: ["element-2"],
      }),
    ).rejects.toThrow(/element scope does not match/);
  });

  it("rejects post-state mismatch and tampered authority evidence", async () => {
    const { snapshot, scenario } = await fixture();
    const expectedFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);

    await expect(
      createApplyVerificationReceipt({
        scenario,
        sourceFingerprint: snapshot.fingerprint,
        expectedFingerprint,
        resultingFingerprint: "d".repeat(64),
        changedElementIds: scenario.candidate.changedElementIds,
      }),
    ).rejects.toThrow(/does not match/);

    const receipt = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: snapshot.fingerprint,
      expectedFingerprint,
      resultingFingerprint: expectedFingerprint,
      changedElementIds: scenario.candidate.changedElementIds,
    });

    expect(
      await validateApplyVerificationReceipt({
        ...receipt,
        safety: { ...receipt.safety, authoritative: true },
      }),
    ).toBe(false);
  });

  it("rejects deceptive receipt descriptors without evaluating getters", async () => {
    const { snapshot, scenario } = await fixture();
    const expectedFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);
    const receipt = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: snapshot.fingerprint,
      expectedFingerprint,
      resultingFingerprint: expectedFingerprint,
      changedElementIds: scenario.candidate.changedElementIds,
    });

    let getterReads = 0;
    const accessorReceipt = { ...receipt };
    Object.defineProperty(accessorReceipt, "receiptFingerprint", {
      enumerable: true,
      get() {
        getterReads += 1;
        return receipt.receiptFingerprint;
      },
    });
    expect(await validateApplyVerificationReceipt(accessorReceipt)).toBe(false);
    expect(getterReads).toBe(0);

    const hiddenReceipt = { ...receipt } as Record<string, unknown>;
    Object.defineProperty(hiddenReceipt, "hidden", { value: true, enumerable: false });
    expect(await validateApplyVerificationReceipt(hiddenReceipt)).toBe(false);

    const symbolicReceipt = { ...receipt } as Record<PropertyKey, unknown>;
    symbolicReceipt[Symbol("hidden")] = true;
    expect(await validateApplyVerificationReceipt(symbolicReceipt)).toBe(false);

    const safety = { ...receipt.safety } as Record<string, unknown>;
    Object.defineProperty(safety, "authoritative", {
      enumerable: true,
      get() {
        getterReads += 1;
        return false;
      },
    });
    expect(await validateApplyVerificationReceipt({ ...receipt, safety })).toBe(false);
    expect(getterReads).toBe(0);
  });
});
