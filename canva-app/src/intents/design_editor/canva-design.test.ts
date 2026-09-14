import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { canApplyScenario, type CanvaDesignSnapshot } from "./canva-design";

const fingerprint = "a".repeat(64);

const snapshot: CanvaDesignSnapshot = {
  designId: "design-1",
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1000, height: 800 },
  elements: [{ id: "element-1", type: "shape", top: 10, left: 20, width: 100, height: 100, rotation: 0, locked: false }],
  fingerprint,
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value)), "utf8").digest("hex");
}

function buildScenario() {
  const scenario = {
    contractVersion: 1 as const,
    scenarioId: "scenario-1",
    source: { designId: "design-1", snapshotId: "snapshot-1", pageIds: ["page-1"], snapshotFingerprint: fingerprint },
    intent: { summary: "Improve hierarchy", objectiveId: "hierarchy-v1", objectiveDirection: "maximize" as const },
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
    presentation: { advisoryOnly: true as const, autoApply: false as const, target: "web-dashboard" as const },
    provenance: { scenarioFingerprint: "", optimizationFingerprint: "" },
  };

  scenario.provenance.optimizationFingerprint = digest({
    sourceSnapshotFingerprint: scenario.source.snapshotFingerprint,
    objective: { id: scenario.intent.objectiveId, direction: scenario.intent.objectiveDirection },
    constraints: {
      hard: scenario.constraints.hard.map(canonical).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      soft: scenario.constraints.soft.map(canonical).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    },
  });
  const unsigned = structuredClone(scenario);
  delete unsigned.provenance.scenarioFingerprint;
  scenario.provenance.scenarioFingerprint = digest(unsigned);
  return scenario;
}

describe("canApplyScenario", () => {
  it("accepts a canonical scenario bound to the current design", async () => {
    expect(await canApplyScenario(buildScenario(), snapshot)).toBe(true);
  });

  it("rejects a scenario when the Canva design identity is not trusted", async () => {
    expect(await canApplyScenario(buildScenario(), { ...snapshot, designId: undefined })).toBe(false);
  });

  it("rejects a scenario from another Canva design", async () => {
    const scenario = buildScenario();
    scenario.source.designId = "design-2";
    expect(await canApplyScenario(scenario, snapshot)).toBe(false);
  });

  it("rejects stale snapshots", async () => {
    const scenario = buildScenario();
    scenario.source.snapshotFingerprint = "d".repeat(64);
    expect(await canApplyScenario(scenario, snapshot)).toBe(false);
  });

  it("rejects tampered canonical provenance", async () => {
    const scenario = buildScenario();
    scenario.evidence.objectiveScore = 0.1;
    expect(await canApplyScenario(scenario, snapshot)).toBe(false);
  });

  it("rejects non-advisory or automatic scenarios", async () => {
    const advisory = buildScenario();
    advisory.presentation.advisoryOnly = false as never;
    expect(await canApplyScenario(advisory, snapshot)).toBe(false);

    const automatic = buildScenario();
    automatic.presentation.autoApply = true as never;
    expect(await canApplyScenario(automatic, snapshot)).toBe(false);
  });
});
