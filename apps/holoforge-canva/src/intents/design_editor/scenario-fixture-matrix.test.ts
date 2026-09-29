import { describe, expect, it } from "vitest";

import { buildScenarioReview } from "./scenario-review";
import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  hasCanonicalProvenance,
  snapshotScenarioForPresentation,
  type HoloForgeScenario,
} from "./scenario-contract";
import type { CanvaDesignSnapshot } from "./canva-design";

type FixtureKind = "hierarchy" | "spacing-balance" | "locked-brand";

const sourceFingerprint = "a".repeat(64);

function scenarioFixture(kind: FixtureKind): HoloForgeScenario {
  const common = {
    contractVersion: 1 as const,
    source: {
      designId: "design-fixture-1",
      snapshotId: "snapshot-fixture-1",
      pageIds: ["page-1"],
      snapshotFingerprint: sourceFingerprint,
    },
    presentation: {
      advisoryOnly: true as const,
      autoApply: false as const,
      target: "web-dashboard" as const,
    },
    provenance: {
      scenarioFingerprint: "0".repeat(64),
      optimizationFingerprint: "0".repeat(64),
    },
  };

  if (kind === "hierarchy") {
    return {
      ...common,
      scenarioId: "fixture-hierarchy-v1",
      intent: {
        summary: "Strengthen visual hierarchy",
        objectiveId: "hierarchy-v1",
        objectiveDirection: "maximize",
      },
      constraints: {
        hard: [{ type: "bounds", pageId: "page-1" }],
        soft: [{ type: "hierarchy", primaryElementId: "headline" }],
      },
      candidate: {
        layout: { elements: { headline: { x: 80, y: 72 } } },
        changedElementIds: ["headline"],
        delta: { headline: { x: 16, y: -8 } },
      },
      evidence: {
        backend: "vaelon",
        algorithm: "deterministic-candidate-v1",
        seed: "fixture-hierarchy-seed",
        status: "complete",
        objectiveScore: 0.92,
        baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.82 },
        objectiveGap: 0.1,
        durationMs: 12,
        hardConstraintsPassed: true,
        warnings: [],
      },
      interpretation: {
        producer: "auren",
        label: "Hierarchy",
        summary: "Promote the headline without changing brand-locked elements.",
        tradeoffs: ["Slightly reduces whitespace above supporting copy."],
      },
    };
  }

  if (kind === "spacing-balance") {
    return {
      ...common,
      scenarioId: "fixture-spacing-balance-v1",
      intent: {
        summary: "Improve spacing and visual balance",
        objectiveId: "spacing-balance-v1",
        objectiveDirection: "maximize",
      },
      constraints: {
        hard: [{ type: "no-overlap", elementIds: ["card-a", "card-b"] }],
        soft: [{ type: "equal-spacing", elementIds: ["card-a", "card-b"], weight: 0.8 }],
      },
      candidate: {
        layout: {
          elements: {
            "card-a": { x: 120, y: 240 },
            "card-b": { x: 420, y: 240 },
          },
        },
        changedElementIds: ["card-a", "card-b"],
        delta: { spacingPx: 40 },
      },
      evidence: {
        backend: "vaelon",
        algorithm: "deterministic-candidate-v1",
        seed: "fixture-spacing-seed",
        status: "complete",
        objectiveScore: 0.88,
        baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.79 },
        objectiveGap: 0.09,
        durationMs: 15,
        hardConstraintsPassed: true,
        warnings: [],
      },
      interpretation: {
        producer: "auren",
        label: "Spacing + balance",
        summary: "Align paired cards to a common visual rhythm.",
        tradeoffs: ["Uses more horizontal page area."],
      },
    };
  }

  return {
    ...common,
    scenarioId: "fixture-locked-brand-v1",
    intent: {
      summary: "Improve layout while preserving locked brand assets",
      objectiveId: "brand-preservation-v1",
      objectiveDirection: "maximize",
    },
    constraints: {
      hard: [
        { type: "locked-element", elementId: "brand-logo", locked: true },
        { type: "bounds", pageId: "page-1" },
      ],
      soft: [{ type: "balance", anchorElementId: "brand-logo" }],
    },
    candidate: {
      layout: { elements: { "content-card": { x: 260, y: 300 } } },
      changedElementIds: ["content-card"],
      delta: { "content-card": { x: 24, y: 12 } },
    },
    evidence: {
      backend: "vaelon",
      algorithm: "deterministic-candidate-v1",
      seed: "fixture-locked-brand-seed",
      status: "complete",
      objectiveScore: 0.9,
      baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.84 },
      objectiveGap: 0.06,
      durationMs: 11,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: "auren",
      label: "Locked brand",
      summary: "Rebalance editable content while leaving the brand logo untouched.",
      tradeoffs: [],
    },
  };
}

async function sealScenario(input: HoloForgeScenario): Promise<HoloForgeScenario> {
  const scenario = structuredClone(input);
  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);
  return scenario;
}

function designSnapshot(): CanvaDesignSnapshot {
  return {
    designId: "design-fixture-1",
    pageId: "page-1",
    pageType: "absolute",
    pageDimensions: { width: 1200, height: 900 },
    elements: [
      {
        id: "headline",
        type: "text",
        top: 80,
        left: 64,
        width: 420,
        height: 80,
        rotation: 0,
        locked: false,
      },
      {
        id: "card-a",
        type: "shape",
        top: 220,
        left: 100,
        width: 240,
        height: 180,
        rotation: 0,
        locked: false,
      },
      {
        id: "card-b",
        type: "shape",
        top: 220,
        left: 400,
        width: 240,
        height: 180,
        rotation: 0,
        locked: false,
      },
      {
        id: "brand-logo",
        type: "image",
        top: 40,
        left: 920,
        width: 180,
        height: 90,
        rotation: 0,
        locked: true,
      },
      {
        id: "content-card",
        type: "shape",
        top: 288,
        left: 236,
        width: 360,
        height: 240,
        rotation: 0,
        locked: false,
      },
    ],
    fingerprint: sourceFingerprint,
  };
}

describe("deterministic scenario fixture matrix", () => {
  it.each<FixtureKind>(["hierarchy", "spacing-balance", "locked-brand"])(
    "seals %s with deterministic classical-baseline evidence and canonical provenance",
    async (kind) => {
      const first = await sealScenario(scenarioFixture(kind));
      const second = await sealScenario(scenarioFixture(kind));

      expect(first.provenance).toEqual(second.provenance);
      expect(first.evidence.baseline).toMatchObject({
        backend: "reference",
        algorithm: "exact-v1",
      });
      expect(first.evidence.backend).toBe("vaelon");
      await expect(hasCanonicalProvenance(first)).resolves.toBe(true);

      const captured = snapshotScenarioForPresentation(first);
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(captured.candidate.layout.elements)).toBe(true);
    },
  );

  it("keeps the locked-brand fixture out of the editable candidate set", async () => {
    const scenario = await sealScenario(scenarioFixture("locked-brand"));
    const review = buildScenarioReview(scenario, designSnapshot());

    expect(scenario.constraints.hard).toContainEqual({
      type: "locked-element",
      elementId: "brand-logo",
      locked: true,
    });
    expect(scenario.candidate.changedElementIds).not.toContain("brand-logo");
    expect(review.map((item) => item.elementId)).toEqual(["content-card"]);
  });

  it("fails canonical provenance after candidate evidence is tampered", async () => {
    const scenario = await sealScenario(scenarioFixture("hierarchy"));
    scenario.candidate.layout.elements.headline.x = 999;

    await expect(hasCanonicalProvenance(scenario)).resolves.toBe(false);
  });
});
