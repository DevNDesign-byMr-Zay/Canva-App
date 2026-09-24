import type { CanvaDesignSnapshot } from "./canva-design";
import { buildScenarioReview } from "./scenario-review";
import {
  HEX_64,
  canonical,
  hasCanonicalProvenance,
  sha256,
  type HoloForgeScenario,
} from "./scenario-contract";

export type SpatialScenarioElement = {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
};

export type SpatialScenarioView = {
  version: 1;
  scenarioId: string;
  source: {
    designId: string;
    pageId: string;
    snapshotFingerprint: string;
  };
  objective: {
    id: string;
    direction: "maximize" | "minimize";
    baselineScore: number;
    candidateScore: number;
    objectiveGap: number;
  };
  layers: [
    {
      id: "source";
      depth: 0;
      elements: SpatialScenarioElement[];
    },
    {
      id: "candidate";
      depth: 1;
      elements: SpatialScenarioElement[];
    },
  ];
  interpretation: {
    label: string;
    summary: string;
    tradeoffs: string[];
  };
  safety: {
    readOnly: true;
    explicitApplyRequired: true;
    authoritative: false;
    autoApply: false;
  };
  viewFingerprint: string;
};

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sourceElement(element: CanvaDesignSnapshot["elements"][number]): SpatialScenarioElement {
  return {
    elementId: element.id,
    x: element.left,
    y: element.top,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    locked: element.locked,
  };
}

export async function createSpatialScenarioView(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): Promise<Readonly<SpatialScenarioView>> {
  if (!snapshot.designId || scenario.source.designId !== snapshot.designId) {
    throw new TypeError("scenario source design must match the reviewed Canva design");
  }
  if (!scenario.source.pageIds.includes(snapshot.pageId)) {
    throw new TypeError("scenario source pages must include the reviewed Canva page");
  }
  if (
    !HEX_64.test(snapshot.fingerprint) ||
    scenario.source.snapshotFingerprint !== snapshot.fingerprint
  ) {
    throw new TypeError("scenario source fingerprint must match the reviewed Canva snapshot");
  }
  if (scenario.presentation.advisoryOnly !== true || scenario.presentation.autoApply !== false) {
    throw new TypeError("spatial scenario view requires advisory-only explicit apply semantics");
  }
  if (scenario.evidence.status !== "complete" || scenario.evidence.hardConstraintsPassed !== true) {
    throw new TypeError("spatial scenario view requires complete constraint-valid evidence");
  }
  if (!(await hasCanonicalProvenance(scenario))) {
    throw new TypeError("spatial scenario view requires canonical scenario provenance");
  }

  const review = buildScenarioReview(scenario, snapshot);
  if (review.length !== scenario.candidate.changedElementIds.length) {
    throw new TypeError("spatial scenario view requires a complete reviewed element mapping");
  }
  const projected = new Map(review.map((item) => [item.elementId, item.after]));

  const sourceElements = snapshot.elements.map(sourceElement);
  const candidateElements = snapshot.elements.map((element) => {
    const after = projected.get(element.id);
    if (!after) return sourceElement(element);
    return {
      elementId: element.id,
      x: after.left,
      y: after.top,
      width: after.width,
      height: after.height,
      rotation: after.rotation,
      locked: element.locked,
    };
  });

  const body = {
    version: 1 as const,
    scenarioId: scenario.scenarioId,
    source: {
      designId: snapshot.designId,
      pageId: snapshot.pageId,
      snapshotFingerprint: snapshot.fingerprint,
    },
    objective: {
      id: scenario.intent.objectiveId,
      direction: scenario.intent.objectiveDirection,
      baselineScore: scenario.evidence.baseline.objectiveScore,
      candidateScore: scenario.evidence.objectiveScore,
      objectiveGap: scenario.evidence.objectiveGap,
    },
    layers: [
      { id: "source" as const, depth: 0 as const, elements: sourceElements },
      { id: "candidate" as const, depth: 1 as const, elements: candidateElements },
    ] as SpatialScenarioView["layers"],
    interpretation: {
      label: scenario.interpretation.label,
      summary: scenario.interpretation.summary,
      tradeoffs: [...scenario.interpretation.tradeoffs],
    },
    safety: {
      readOnly: true as const,
      explicitApplyRequired: true as const,
      authoritative: false as const,
      autoApply: false as const,
    },
  };

  const viewFingerprint = await sha256(canonical(body, "spatial scenario view"));
  return deepFreeze({ ...body, viewFingerprint });
}
