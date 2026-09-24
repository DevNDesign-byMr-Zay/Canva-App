import type { CanvaDesignSnapshot } from "./canva-design";
import type { PlacementExperimentResult } from "./placement-experiment";
import {
  computeOptimizationFingerprint,
  computeScenarioFingerprint,
  type HoloForgeScenario,
} from "./scenario-contract";

function text(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

export async function createPlacementScenario({
  snapshot,
  experiment,
  scenarioId,
  snapshotId,
  intentSummary,
}: {
  snapshot: CanvaDesignSnapshot;
  experiment: PlacementExperimentResult;
  scenarioId: string;
  snapshotId: string;
  intentSummary: string;
}): Promise<Readonly<HoloForgeScenario>> {
  if (!snapshot.designId) throw new TypeError("trusted design identity is required");
  if (experiment.sourceFingerprint !== snapshot.fingerprint) {
    throw new TypeError("placement experiment must match the reviewed snapshot fingerprint");
  }
  if (experiment.comparison !== "observational-only") {
    throw new TypeError("placement experiment must remain observational-only");
  }
  if (experiment.safety.autoApply !== false || experiment.safety.authoritative !== false) {
    throw new TypeError("placement experiment must remain non-authoritative and non-auto-applying");
  }

  const byId = new Map(snapshot.elements.map((element) => [element.id, element]));
  const changedElementIds = experiment.candidate.assignments.map((assignment) => {
    const element = byId.get(assignment.elementId);
    if (!element) {
      throw new TypeError(`candidate element is not present in reviewed snapshot: ${assignment.elementId}`);
    }
    if (element.locked) {
      throw new TypeError(`candidate element is locked in reviewed snapshot: ${assignment.elementId}`);
    }
    return assignment.elementId;
  });
  if (new Set(changedElementIds).size !== changedElementIds.length) {
    throw new TypeError("candidate assignments must use unique element identities");
  }

  const layout = Object.fromEntries(
    experiment.candidate.assignments.map((assignment) => [
      assignment.elementId,
      { x: assignment.x, y: assignment.y },
    ]),
  );
  const delta = Object.fromEntries(
    experiment.candidate.assignments.map((assignment) => {
      const source = byId.get(assignment.elementId)!;
      return [
        assignment.elementId,
        {
          x: Number((assignment.x - source.left).toFixed(6)),
          y: Number((assignment.y - source.top).toFixed(6)),
        },
      ];
    }),
  );

  const scenario: HoloForgeScenario = {
    contractVersion: 1,
    scenarioId: text(scenarioId, "scenarioId"),
    source: {
      designId: snapshot.designId,
      snapshotId: text(snapshotId, "snapshotId"),
      pageIds: [snapshot.pageId],
      snapshotFingerprint: snapshot.fingerprint,
    },
    intent: {
      summary: text(intentSummary, "intentSummary"),
      objectiveId: experiment.objective,
      objectiveDirection: "minimize",
    },
    constraints: {
      hard: [
        {
          type: "reviewed-element-identity",
          elementIds: changedElementIds,
        },
      ],
      soft: [
        {
          type: "placement-distance",
          weight: 1,
        },
      ],
    },
    candidate: {
      layout: { elements: layout },
      changedElementIds,
      delta,
    },
    evidence: {
      backend: experiment.candidate.backend,
      algorithm: experiment.candidate.algorithm,
      seed: experiment.candidate.seed,
      status: experiment.candidate.status,
      objectiveScore: experiment.candidate.objectiveScore,
      baseline: {
        backend: experiment.classical.backend,
        algorithm: experiment.classical.algorithm,
        objectiveScore: experiment.classical.objectiveScore,
      },
      objectiveGap: experiment.objectiveGap,
      durationMs: 0,
      hardConstraintsPassed: true,
      warnings: [
        "Placement comparison is observational evidence; no candidate superiority is assumed.",
      ],
    },
    interpretation: {
      producer: "auren",
      label: "Measured placement comparison",
      summary:
        "Compare the deterministic VÆLON placement candidate with the exact classical reference before any explicit Apply.",
      tradeoffs: [
        `Measured objective gap: ${experiment.objectiveGap}`,
      ],
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

  scenario.provenance.optimizationFingerprint = await computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = await computeScenarioFingerprint(scenario);

  return Object.freeze(scenario);
}
