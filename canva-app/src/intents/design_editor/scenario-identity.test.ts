import { describe, expect, it } from "vitest";

import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  hasCanonicalProvenance,
  hasUniqueChangedElementIds,
  snapshotScenarioForPresentation,
  type HoloForgeScenario,
} from "./scenario-contract";

function scenarioWith(ids: string[]): HoloForgeScenario {
  return {
    candidate: { changedElementIds: ids },
  } as HoloForgeScenario;
}

function identityScenario(overrides: Partial<HoloForgeScenario> = {}): HoloForgeScenario {
  return {
    contractVersion: 1,
    scenarioId: "scenario-identity-1",
    source: {
      designId: "design-1",
      snapshotId: "snapshot-1",
      pageIds: ["page-1"],
      snapshotFingerprint: "a".repeat(64),
    },
    intent: {
      summary: "balance layout",
      objectiveId: "balance",
      objectiveDirection: "maximize",
    },
    constraints: {
      hard: [
        { type: "bounds", axis: "x", max: 100 },
        { type: "locked", id: "element-2" },
      ],
      soft: [{ type: "spacing", weight: 0.5 }],
    },
    candidate: {
      layout: {
        elements: {
          "element-1": { x: 10, y: 20, rotation: 0 },
        },
      },
      changedElementIds: ["element-1"],
      delta: { moved: 1 },
    },
    evidence: {
      backend: "reference",
      algorithm: "deterministic",
      seed: "seed-identity-1",
      status: "complete",
      objectiveScore: 1,
      baseline: { backend: "reference", algorithm: "baseline", objectiveScore: 0 },
      objectiveGap: 1,
      durationMs: 1,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: "upstream",
      label: "review",
      summary: "review candidate",
      tradeoffs: [],
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
    ...overrides,
  };
}

describe("scenario changed element identity", () => {
  it("accepts unique ids", () => {
    expect(hasUniqueChangedElementIds(scenarioWith(["element-1", "element-2"]))).toBe(true);
  });

  it("fails closed when an id is repeated", () => {
    expect(hasUniqueChangedElementIds(scenarioWith(["element-1", "element-1"]))).toBe(false);
  });
});

describe("canonical scenario fingerprints", () => {
  it("canonicalizes equivalent hard and soft constraint ordering independently", async () => {
    const first = identityScenario();
    const second = identityScenario({
      constraints: {
        hard: [...first.constraints.hard].reverse(),
        soft: [...first.constraints.soft],
      },
    });

    await expect(computeOptimizationFingerprint(first)).resolves.toBe(
      await computeOptimizationFingerprint(second),
    );
  });

  it("keeps hard/soft constraint membership identity-significant", async () => {
    const first = identityScenario();
    const second = identityScenario({
      constraints: {
        hard: [first.constraints.hard[0]],
        soft: [first.constraints.hard[1], ...first.constraints.soft],
      },
    });

    expect(await computeOptimizationFingerprint(first)).not.toBe(
      await computeOptimizationFingerprint(second),
    );
  });

  it("rejects accessor-backed constraint evidence without executing getters", async () => {
    const scenario = identityScenario();
    let reads = 0;
    const deceptive = {};
    Object.defineProperty(deceptive, "type", {
      enumerable: true,
      get() {
        reads += 1;
        return "bounds";
      },
    });
    scenario.constraints.hard = [deceptive];

    await expect(computeOptimizationFingerprint(scenario)).rejects.toThrow(
      /must be enumerable data/,
    );
    expect(reads).toBe(0);
  });

  it("rejects inherited, symbol-backed, sparse, and decorated identity evidence", async () => {
    const inherited = identityScenario();
    inherited.constraints.hard = [Object.create({ type: "bounds" })];
    await expect(computeOptimizationFingerprint(inherited)).rejects.toThrow(
      /must use plain objects/,
    );

    const symbolBacked = identityScenario();
    const symbolic = { type: "bounds" } as Record<PropertyKey, unknown>;
    symbolic[Symbol("hidden")] = true;
    symbolBacked.constraints.hard = [symbolic];
    await expect(computeOptimizationFingerprint(symbolBacked)).rejects.toThrow(/symbol properties/);

    const sparse = identityScenario();
    sparse.constraints.hard = new Array(1);
    await expect(computeOptimizationFingerprint(sparse)).rejects.toThrow(/sparse arrays/);

    const decorated = identityScenario();
    const values = [{ type: "bounds" }] as Array<unknown> & { authority?: string };
    values.authority = "hidden";
    decorated.constraints.hard = values;
    await expect(computeOptimizationFingerprint(decorated)).rejects.toThrow(
      /arrays must not contain extra properties/,
    );
  });

  it("rejects non-finite values from scenario fingerprint identity", async () => {
    const scenario = identityScenario();
    scenario.candidate.layout.elements["element-1"].x = Number.NaN;

    await expect(computeScenarioFingerprint(scenario)).rejects.toThrow(/numbers must be finite/);
  });

  it("fails closed on deceptive provenance instead of evaluating accessors", async () => {
    const scenario = identityScenario();
    let reads = 0;
    Object.defineProperty(scenario.provenance, "scenarioFingerprint", {
      enumerable: true,
      get() {
        reads += 1;
        return "f".repeat(64);
      },
    });

    await expect(hasCanonicalProvenance(scenario)).resolves.toBe(false);
    expect(reads).toBe(0);
  });
});

describe("presentation scenario snapshot", () => {
  it("isolates rendered decision state from later caller mutation", () => {
    const source = identityScenario();
    source.constraints.hard = [{ type: "bounds", limits: { maxX: 100 } }];
    source.candidate.layout.elements["element-1"] = { x: 10, y: 20 };
    source.candidate.delta = { moved: { to: { x: 10 } } };

    const captured = snapshotScenarioForPresentation(source);

    (source.constraints.hard[0] as { limits: { maxX: number } }).limits.maxX = 999;
    source.candidate.layout.elements["element-1"].x = 999;
    (source.candidate.delta.moved as { to: { x: number } }).to.x = 999;

    expect((captured.constraints.hard[0] as { limits: { maxX: number } }).limits.maxX).toBe(100);
    expect(captured.candidate.layout.elements["element-1"].x).toBe(10);
    expect((captured.candidate.delta.moved as { to: { x: number } }).to.x).toBe(10);
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.constraints.hard[0])).toBe(true);
    expect(Object.isFrozen(captured.candidate.layout.elements["element-1"])).toBe(true);
  });

  it("rejects deceptive caller-owned scenario state before presentation", () => {
    const source = identityScenario();
    let reads = 0;
    Object.defineProperty(source.candidate.delta, "hidden", {
      enumerable: true,
      get() {
        reads += 1;
        return "authority";
      },
    });

    expect(() => snapshotScenarioForPresentation(source)).toThrow(/must be enumerable data/);
    expect(reads).toBe(0);
  });
});
