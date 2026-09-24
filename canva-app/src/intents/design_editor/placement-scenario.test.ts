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
  canApplyScenario,
  computeCanvaSnapshotFingerprint,
  type CanvaDesignSnapshot,
} from "./canva-design";
import { runPlacementExperiment } from "./placement-experiment";
import { createPlacementScenario } from "./placement-scenario";
import { hasCanonicalProvenance } from "./scenario-contract";
import { buildSpatialPreviewModel } from "./spatial-preview";

async function reviewedSnapshot(): Promise<CanvaDesignSnapshot> {
  const base: Omit<CanvaDesignSnapshot, "fingerprint"> = {
    designId: "design-bridge-1",
    pageId: "page-1",
    pageType: "absolute",
    pageDimensions: { width: 1000, height: 800 },
    elements: [
      { id: "a", type: "shape", top: 100, left: 100, width: 100, height: 100, rotation: 0, locked: false },
      { id: "b", type: "shape", top: 100, left: 700, width: 100, height: 100, rotation: 0, locked: false },
    ],
  };
  return {
    ...base,
    fingerprint: await computeCanvaSnapshotFingerprint(base),
  };
}

describe("placement scenario bridge", () => {
  it("converts measured comparison evidence into a canonical preview/apply scenario", async () => {
    const snapshot = await reviewedSnapshot();
    const experiment = runPlacementExperiment({
      snapshot,
      elementIds: ["a", "b"],
      slots: [
        { slotId: "left", x: 120, y: 120 },
        { slotId: "right", x: 680, y: 120 },
      ],
    });

    const scenario = await createPlacementScenario({
      snapshot,
      experiment,
      scenarioId: "placement-scenario-1",
      snapshotId: "snapshot-bridge-1",
      intentSummary: "Compare a measured placement candidate",
    });

    await expect(hasCanonicalProvenance(scenario)).resolves.toBe(true);
    await expect(canApplyScenario(scenario, snapshot)).resolves.toBe(true);

    const preview = buildSpatialPreviewModel(scenario, snapshot);
    expect(preview.scenarioId).toBe(scenario.scenarioId);
    expect(preview.safety.authoritative).toBe(false);
    expect(scenario.evidence.baseline.backend).toBe("classical-reference");
    expect(scenario.evidence.backend).toBe("vaelon");
    expect(scenario.presentation.autoApply).toBe(false);
  });

  it("rejects experiment evidence from another reviewed snapshot", async () => {
    const snapshot = await reviewedSnapshot();
    const experiment = runPlacementExperiment({
      snapshot,
      elementIds: ["a"],
      slots: [{ slotId: "left", x: 120, y: 120 }],
    });

    await expect(
      createPlacementScenario({
        snapshot: { ...snapshot, fingerprint: "f".repeat(64) },
        experiment,
        scenarioId: "placement-scenario-2",
        snapshotId: "snapshot-bridge-2",
        intentSummary: "Reject stale evidence",
      }),
    ).rejects.toThrow(/reviewed snapshot fingerprint/);
  });

  it("never converts authoritative or auto-apply experiment state into a scenario", async () => {
    const snapshot = await reviewedSnapshot();
    const experiment = runPlacementExperiment({
      snapshot,
      elementIds: ["a"],
      slots: [{ slotId: "left", x: 120, y: 120 }],
    });
    const unsafe = {
      ...experiment,
      safety: { autoApply: true, authoritative: true },
    };

    await expect(
      createPlacementScenario({
        snapshot,
        experiment: unsafe as typeof experiment,
        scenarioId: "placement-scenario-3",
        snapshotId: "snapshot-bridge-3",
        intentSummary: "Reject unsafe evidence",
      }),
    ).rejects.toThrow(/non-authoritative/);
  });
});
