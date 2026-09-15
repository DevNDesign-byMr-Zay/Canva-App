import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(globalThis, {
    canva_sdk: {
      design: {
        v2: {
          designInteraction: {
            selection: {},
            overlay: {},
            addPage: vi.fn(),
          },
        },
      },
    },
  });
});

vi.mock("@canva/design", () => ({
  getCurrentPageMetadata: vi.fn(),
  getDesignMetadata: vi.fn(),
  openDesign: vi.fn(),
}));

import {
  computeCanvaSnapshotFingerprint,
  getReviewedElementBinding,
} from "./canva-design";
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

describe("Canva snapshot fingerprint", () => {
  const base = {
    designId: "design-1",
    pageId: "page-1",
    pageDimensions: { width: 1200, height: 800 },
    elements: [{
      id: "element-1",
      type: "RECTANGLE",
      top: 20,
      left: 40,
      width: 200,
      height: 100,
      rotation: 0,
      locked: false,
    }],
  } as const;

  it("is deterministic for equivalent snapshots", async () => {
    const first = await computeCanvaSnapshotFingerprint(base);
    const second = await computeCanvaSnapshotFingerprint({
      ...base,
      elements: base.elements.map((element) => ({ ...element })),
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds identity, geometry, and element order into the fingerprint", async () => {
    const original = await computeCanvaSnapshotFingerprint(base);
    const identityChanged = await computeCanvaSnapshotFingerprint({ ...base, designId: "design-2" });
    const geometryChanged = await computeCanvaSnapshotFingerprint({
      ...base,
      elements: [{ ...base.elements[0], left: 41 }],
    });
    const orderChanged = await computeCanvaSnapshotFingerprint({
      ...base,
      elements: [
        { ...base.elements[0], id: "element-2" },
        { ...base.elements[0], id: "element-1", left: 10 },
      ],
    });

    expect(identityChanged).not.toBe(original);
    expect(geometryChanged).not.toBe(original);
    expect(orderChanged).not.toBe(original);
  });

  it("normalizes an absent trusted design identity to null", async () => {
    const withoutIdentity = await computeCanvaSnapshotFingerprint({ ...base, designId: undefined });
    const explicitNull = await computeCanvaSnapshotFingerprint({ ...base, designId: undefined });
    expect(withoutIdentity).toBe(explicitNull);
  });
});

describe("reviewed element binding", () => {
  const elements = [
    { id: "element-1", type: "RECTANGLE", top: 20, left: 40, width: 200, height: 100, rotation: 0, locked: false },
    { id: "element-2", type: "TEXT", top: 60, left: 80, width: 300, height: 50, rotation: 0, locked: false },
  ];

  async function buildSnapshot() {
    const snapshot = {
      designId: "design-1",
      pageId: "page-1",
      pageType: "absolute" as const,
      pageDimensions: { width: 1200, height: 800 },
      elements,
      fingerprint: "",
    };
    snapshot.fingerprint = await computeCanvaSnapshotFingerprint(snapshot);
    return snapshot;
  }

  it("binds canonical changed-element keys to reviewed snapshot indexes", async () => {
    const snapshot = await buildSnapshot();
    const binding = getReviewedElementBinding(await signedScenario(), snapshot);
    expect(binding).toBeNull();

    const scenario = await signedScenario();
    scenario.source.snapshotFingerprint = snapshot.fingerprint;
    scenario.candidate.changedElementIds = ["element-1", "element-2"];
    scenario.candidate.layout.elements["element-2"] = { x: 90 };
    const reviewed = getReviewedElementBinding(scenario, snapshot);
    expect(reviewed?.get("element-1")).toBe(0);
    expect(reviewed?.get("element-2")).toBe(1);
    expect(reviewed?.size).toBe(2);
  });

  it("fails closed when a scenario asks for an element absent from the reviewed snapshot", async () => {
    const snapshot = await buildSnapshot();
    const scenario = await signedScenario();
    scenario.source.snapshotFingerprint = snapshot.fingerprint;
    scenario.candidate.changedElementIds = ["element-3"];
    scenario.candidate.layout.elements["element-3"] = { x: 90 };
    expect(getReviewedElementBinding(scenario, snapshot)).toBeNull();
  });

  it("fails closed when duplicate changed-element keys are supplied", async () => {
    const snapshot = await buildSnapshot();
    const scenario = await signedScenario();
    scenario.source.snapshotFingerprint = snapshot.fingerprint;
    scenario.candidate.changedElementIds = ["element-1", "element-1"];
    expect(getReviewedElementBinding(scenario, snapshot)).toBeNull();
  });

  it("fails closed when the scenario fingerprint points at a different snapshot", async () => {
    const snapshot = await buildSnapshot();
    const scenario = await signedScenario();
    expect(getReviewedElementBinding(scenario, snapshot)).toBeNull();
  });

  it("fails closed for inherited layout properties", async () => {
    const snapshot = await buildSnapshot();
    const scenario = await signedScenario();
    scenario.source.snapshotFingerprint = snapshot.fingerprint;
    scenario.candidate.changedElementIds = ["toString"];
    expect(getReviewedElementBinding(scenario, snapshot)).toBeNull();
  });
});
