import { describe, expect, it } from "vitest";

import type { CanvaDesignSnapshot } from "./canva-design";
import type { HoloForgeScenario } from "./scenario-contract";
import { buildSpatialPreviewModel, interpolateSpatialPreview } from "./spatial-preview";

const designId = "design-spatial-1";

const snapshot: CanvaDesignSnapshot = {
  designId,
  pageId: "page-1",
  pageType: "absolute",
  pageDimensions: { width: 1200, height: 900 },
  elements: [
    {
      id: "headline",
      type: "text",
      top: 100,
      left: 80,
      width: 400,
      height: 80,
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
      id: "card",
      type: "shape",
      top: 320,
      left: 220,
      width: 360,
      height: 240,
      rotation: 0,
      locked: false,
    },
  ],
  fingerprint: "a".repeat(64),
};

const scenario = {
  contractVersion: 1,
  scenarioId: "scenario-spatial-1",
  source: {
    designId,
    snapshotId: "snapshot-spatial-1",
    pageIds: [snapshot.pageId],
    snapshotFingerprint: snapshot.fingerprint,
  },
  intent: {
    summary: "Improve hierarchy and balance",
    objectiveId: "spatial-preview-v1",
    objectiveDirection: "maximize",
  },
  constraints: { hard: [], soft: [] },
  candidate: {
    layout: {
      elements: {
        headline: { x: 120, y: 70, rotation: 5 },
        card: { x: 300, y: 340 },
      },
    },
    changedElementIds: ["headline", "card"],
    delta: {},
  },
  evidence: {
    backend: "vaelon",
    algorithm: "deterministic-candidate-v1",
    seed: "spatial-seed-1",
    status: "complete",
    objectiveScore: 0.9,
    baseline: { backend: "reference", algorithm: "exact-v1", objectiveScore: 0.8 },
    objectiveGap: 0.1,
    durationMs: 10,
    hardConstraintsPassed: true,
    warnings: [],
  },
  interpretation: {
    producer: "auren",
    label: "Spatial preview",
    summary: "Compare reviewed source and advisory candidate",
    tradeoffs: [],
  },
  presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
  provenance: {
    scenarioFingerprint: "b".repeat(64),
    optimizationFingerprint: "c".repeat(64),
  },
} satisfies HoloForgeScenario;

describe("spatial preview model", () => {
  it("builds deterministic source/candidate branches with depth and relationships", () => {
    const first = buildSpatialPreviewModel(scenario, snapshot);
    const second = buildSpatialPreviewModel(structuredClone(scenario), structuredClone(snapshot));

    expect(first).toEqual(second);
    expect(first.interpretation).toBe("read-only-spatial-preview");
    expect(first.safety).toEqual({
      readOnly: true,
      autoApply: false,
      authoritative: false,
    });
    expect(first.elements.map((item) => [item.elementId, item.changed, item.depth])).toEqual([
      ["headline", true, 100],
      ["brand-logo", false, 1],
      ["card", true, 102],
    ]);
    expect(first.relationships).toEqual([
      {
        fromElementId: "headline",
        toElementId: "card",
        kind: "review-sequence",
        advisoryOnly: true,
      },
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.elements[0])).toBe(true);
  });

  it("scrubs deterministically between reviewed source and advisory candidate", () => {
    const model = buildSpatialPreviewModel(scenario, snapshot);

    expect(interpolateSpatialPreview(model, 0).find((item) => item.elementId === "headline")).toMatchObject({
      x: 80,
      y: 100,
      rotation: 0,
    });
    expect(interpolateSpatialPreview(model, 0.5).find((item) => item.elementId === "headline")).toMatchObject({
      x: 100,
      y: 85,
      rotation: 2.5,
    });
    expect(interpolateSpatialPreview(model, 1).find((item) => item.elementId === "headline")).toMatchObject({
      x: 120,
      y: 70,
      rotation: 5,
    });
  });

  it("keeps unchanged locked brand elements identical across branches", () => {
    const model = buildSpatialPreviewModel(scenario, snapshot);
    const logo = model.elements.find((item) => item.elementId === "brand-logo");

    expect(logo?.changed).toBe(false);
    expect(logo?.source).toEqual(logo?.candidate);
  });

  it("fails closed on mismatched source identity or invalid scrub progress", () => {
    expect(() =>
      buildSpatialPreviewModel(
        {
          ...scenario,
          source: { ...scenario.source, snapshotFingerprint: "d".repeat(64) },
        },
        snapshot,
      ),
    ).toThrow(/source fingerprint/);

    const model = buildSpatialPreviewModel(scenario, snapshot);
    expect(() => interpolateSpatialPreview(model, -0.1)).toThrow(/progress/);
    expect(() => interpolateSpatialPreview(model, Number.NaN)).toThrow(/progress/);
    expect(() => interpolateSpatialPreview(model, 1.1)).toThrow(/progress/);
  });
});
