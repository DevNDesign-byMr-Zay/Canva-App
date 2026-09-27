import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@canva/design", () => ({
  getCurrentPageMetadata: vi.fn(),
  getDesignMetadata: vi.fn(),
  openDesign: vi.fn(),
}));
import { getCurrentPageMetadata, getDesignMetadata, openDesign } from "@canva/design";
import {
  applyScenario,
  readCurrentDesignSnapshot,
  getReviewedElementBinding,
} from "./canva-design";
import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  type HoloForgeScenario,
} from "./scenario-contract";
const fingerprint = "a".repeat(64);
function buildScenario(): HoloForgeScenario {
  return {
    contractVersion: 1,
    scenarioId: "scenario-1",
    source: {
      designId: "design-1",
      snapshotId: "snapshot-1",
      pageIds: ["page-1"],
      snapshotFingerprint: fingerprint,
    },
    intent: {
      summary: "Improve hierarchy",
      objectiveId: "hierarchy-v1",
      objectiveDirection: "maximize",
    },
    constraints: {
      hard: [{ id: "keep-element", elementId: "element-1" }],
      soft: [{ id: "spacing", weight: 0.4 }],
    },
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
      baseline: {
        backend: "classical-reference",
        algorithm: "exact-reference-v1",
        objectiveScore: 0.95,
      },
      objectiveGap: 0.05,
      durationMs: 12,
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
}

const element = {
  type: "shape",
  top: 0,
  left: 0,
  width: 100,
  height: 80,
  rotation: 0,
  locked: false,
};
let live: typeof element;
let page: {
  type: "absolute";
  id: string;
  locked: boolean;
  dimensions: { width: number; height: number };
  elements: { toArray(): (typeof element)[] };
};
let sync: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  live = { ...element };
  page = {
    type: "absolute",
    id: "page-1",
    locked: false,
    dimensions: { width: 800, height: 600 },
    elements: { toArray: () => [live] },
  };
  sync = vi.fn().mockResolvedValue(undefined);
  vi.mocked(getDesignMetadata).mockResolvedValue({ title: "Test design" } as never);
  vi.mocked(getCurrentPageMetadata).mockResolvedValue(page as never);
  vi.mocked(openDesign).mockImplementation(async (_options, callback) => {
    await callback({ page, sync } as never);
  });
});
async function reviewed() {
  const snapshot = await readCurrentDesignSnapshot({ trustedDesignId: " design-1 " });
  const scenario = buildScenario();
  scenario.source.snapshotFingerprint = snapshot.fingerprint;
  scenario.candidate.layout.elements["element-1"] = { x: 40, y: 20, rotation: 5 };
  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);
  return { scenario, snapshot };
}
it("reads a trusted snapshot and applies only the reviewed transform with a verified receipt", async () => {
  const { scenario, snapshot } = await reviewed();
  expect(snapshot.designId).toBe("design-1");
  const receipt = await applyScenario(scenario, snapshot);
  expect(live).toMatchObject({ left: 40, top: 20, rotation: 5 });
  expect(sync).toHaveBeenCalledTimes(1);
  expect(receipt.expectedFingerprint).toBe(receipt.resultingFingerprint);
});
it("does not invent a design identity when none is trusted", async () => {
  expect((await readCurrentDesignSnapshot()).designId).toBeUndefined();
});
it("rejects unsupported metadata before opening an editor session", async () => {
  vi.mocked(getCurrentPageMetadata).mockResolvedValue({ type: "unsupported" } as never);
  await expect(readCurrentDesignSnapshot()).rejects.toThrow("absolute Canva page");
  expect(openDesign).not.toHaveBeenCalled();
});
it("rejects a page change during snapshot capture", async () => {
  vi.mocked(getCurrentPageMetadata).mockResolvedValue({ ...page, id: "old-page" } as never);
  await expect(readCurrentDesignSnapshot()).rejects.toThrow("page changed");
});
it.each(["locked", "page", "dimensions", "changed", "element-locked", "unsupported"])(
  "fails closed when live state is %s",
  async (condition) => {
    const { scenario, snapshot } = await reviewed();
    if (condition === "locked") page.locked = true;
    if (condition === "page") page.id = "other-page";
    if (condition === "dimensions") Object.assign(page, { dimensions: undefined });
    if (condition === "changed") live.left = 999;
    if (condition === "element-locked") live.locked = true;
    if (condition === "unsupported") live.type = "unsupported";
    await expect(applyScenario(scenario, snapshot)).rejects.toThrow();
    expect(sync).not.toHaveBeenCalled();
  },
);
it("does not return proof for an unverified scenario", async () => {
  const { scenario, snapshot } = await reviewed();
  scenario.provenance.scenarioFingerprint = "0".repeat(64);
  await expect(applyScenario(scenario, snapshot)).rejects.toThrow("not safe to apply");
});
it("rejects a post-state that diverges during sync", async () => {
  const { scenario, snapshot } = await reviewed();
  sync.mockImplementation(async () => {
    live.left = 999;
  });
  await expect(applyScenario(scenario, snapshot)).rejects.toThrow();
});
it("propagates SDK sync failure without a receipt", async () => {
  const { scenario, snapshot } = await reviewed();
  sync.mockRejectedValue(new Error("SDK sync failed"));
  await expect(applyScenario(scenario, snapshot)).rejects.toThrow("SDK sync failed");
});
it("rejects an SDK session that never executes the transaction", async () => {
  const { scenario, snapshot } = await reviewed();
  vi.mocked(openDesign).mockResolvedValue(undefined);
  await expect(applyScenario(scenario, snapshot)).rejects.toThrow("without a verifiable");
});
it("exposes a read-only reviewed element map for all standard read operations", async () => {
  const { scenario, snapshot } = await reviewed();
  const binding = getReviewedElementBinding(scenario, snapshot)!;
  expect(binding.size).toBe(1);
  expect([...binding.keys()]).toEqual(["element-1"]);
  expect([...binding.values()]).toEqual([0]);
  expect([...binding.entries()]).toEqual([["element-1", 0]]);
  expect([...binding]).toEqual([["element-1", 0]]);
  const entries: unknown[] = [];
  binding.forEach((value, key, map) => entries.push([key, value, map === binding]));
  expect(entries).toEqual([["element-1", 0, true]]);
  expect("set" in binding).toBe(false);
});
