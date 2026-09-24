import { describe, expect, it } from "vitest";

import type { CanvaDesignSnapshot } from "./canva-design";
import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  type HoloForgeScenario,
} from "./scenario-contract";
import { createSpatialScenarioView } from "./spatial-scenario-view";

const snapshot: CanvaDesignSnapshot = {
  designId: "design-spatial-1",
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1200, height: 900 },
  elements: [
    {
      id: "headline",
      type: "text",
      top: 80,
      left: 60,
      width: 420,
      height: 90,
      rotation: 0,
      locked: false,
    },
    {
      id: "brand-logo",
      type: "image",
      top: 40,
      left: 940,
      width: 160,
      height: 80,
      rotation: 0,
      locked: true,
    },
  ],
  fingerprint: "a".repeat(64),
};

function baseScenario(): HoloForgeScenario {
  return {
    contractVersion: 1,
    scenarioId: "scenario-spatial-1",
    source: {
      designId: "design-spatial-1",
      snapshotId: "snapshot-spatial-1",
      pageIds: ["page-1"],
      snapshotFingerprint: snapshot.fingerprint,
    },
    intent: {
      summary: "Improve headline hierarchy",
      objectiveId: "hierarchy-v1",
      objectiveDirection: "maximize",
    },
    constraints: {
      hard: [{ type: "locked-element", elementId: "brand-logo" }],
      soft: [{ type: "hierarchy", primaryElementId: "headline" }],
    },
    candidate: {
      layout: {
        elements: {
          headline: { x: 84, y: 64, rotation: 0 },
        },
      },
      changedElementIds: ["headline"],
      delta: { headline: { x: 24, y: -16 } },
    },
    evidence: {
      backend: "vaelon",
      algorithm: "deterministic-candidate-v1",
      seed: "spatial-seed-1",
      status: "complete",
      objectiveScore: 0.93,
      baseline: {
        backend: "reference",
        algorithm: "exact-v1",
        objectiveScore: 0.81,
      },
      objectiveGap: 0.12,
      durationMs: 10,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: "auren",
      label: "Hierarchy",
      summary: "Move the headline into a stronger focal position.",
      tradeoffs: ["Uses slightly more top-left space."],
    },
    presentation: {
      advisoryOnly: true,
      autoApply: false,
      target: "web-dashboard",
    },
    provenance: {
      scenarioFingerprint: "0".repeat(64),
      optimizationFingerprint: "0".repeat(64),
    },
  };
}

async function sealedScenario(): Promise<HoloForgeScenario> {
  const scenario = baseScenario();
  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);
  return scenario;
}

describe("spatial scenario view", () => {
  it("creates deterministic source and candidate depth layers with measured evidence", async () => {
    const scenario = await sealedScenario();

    const first = await createSpatialScenarioView(scenario, snapshot);
    const second = await createSpatialScenarioView(await sealedScenario(), snapshot);

    expect(first).toEqual(second);
    expect(first.layers[0].id).toBe("source");
    expect(first.layers[0].depth).toBe(0);
    expect(first.layers[1].id).toBe("candidate");
    expect(first.layers[1].depth).toBe(1);
    expect(first.layers[0].elements.find((item) => item.elementId === "headline")).toMatchObject({
      x: 60,
      y: 80,
    });
    expect(first.layers[1].elements.find((item) => item.elementId === "headline")).toMatchObject({
      x: 84,
      y: 64,
    });
    expect(first.objective).toEqual({
      id: "hierarchy-v1",
      direction: "maximize",
      baselineScore: 0.81,
      candidateScore: 0.93,
      objectiveGap: 0.12,
    });
    expect(first.safety).toEqual({
      readOnly: true,
      explicitApplyRequired: true,
      authoritative: false,
      autoApply: false,
    });
    expect(first.viewFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.layers[1].elements)).toBe(true);
  });

  it("keeps locked brand elements unchanged in the candidate branch", async () => {
    const view = await createSpatialScenarioView(await sealedScenario(), snapshot);
    const sourceLogo = view.layers[0].elements.find((item) => item.elementId === "brand-logo");
    const candidateLogo = view.layers[1].elements.find((item) => item.elementId === "brand-logo");

    expect(candidateLogo).toEqual(sourceLogo);
    expect(candidateLogo?.locked).toBe(true);
  });

  it("fails closed on source identity drift", async () => {
    const scenario = await sealedScenario();

    await expect(
      createSpatialScenarioView(scenario, {
        ...snapshot,
        designId: "design-substituted",
      }),
    ).rejects.toThrow(/source design/);
  });

  it("fails closed after scenario provenance is tampered", async () => {
    const scenario = await sealedScenario();
    scenario.candidate.layout.elements.headline.x = 999;

    await expect(createSpatialScenarioView(scenario, snapshot)).rejects.toThrow(
      /canonical scenario provenance/,
    );
  });

  it("requires complete constraint-valid evidence", async () => {
    const scenario = await sealedScenario();
    scenario.evidence.hardConstraintsPassed = false;
    scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);

    await expect(createSpatialScenarioView(scenario, snapshot)).rejects.toThrow(
      /complete constraint-valid evidence/,
    );
  });
});
