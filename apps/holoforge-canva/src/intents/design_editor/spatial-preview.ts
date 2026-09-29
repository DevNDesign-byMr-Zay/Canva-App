import type { CanvaDesignSnapshot } from "./canva-design";
import type { HoloForgeScenario } from "./scenario-contract";
import { buildScenarioReview } from "./scenario-review";

export type SpatialPreviewElement = {
  elementId: string;
  depth: number;
  source: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  candidate: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  changed: boolean;
};

export type SpatialPreviewRelationship = {
  fromElementId: string;
  toElementId: string;
  kind: "review-sequence";
  advisoryOnly: true;
};

export type SpatialPreviewModel = {
  version: 1;
  interpretation: "read-only-spatial-preview";
  scenarioId: string;
  sourceFingerprint: string;
  branches: {
    source: "reviewed-source";
    candidate: "advisory-candidate";
  };
  elements: SpatialPreviewElement[];
  relationships: SpatialPreviewRelationship[];
  safety: {
    readOnly: true;
    autoApply: false;
    authoritative: false;
  };
};

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function geometry(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  path: string,
) {
  return {
    x: finite(x, `${path}.x`),
    y: finite(y, `${path}.y`),
    width: finite(width, `${path}.width`),
    height: finite(height, `${path}.height`),
    rotation: finite(rotation, `${path}.rotation`),
  };
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function buildSpatialPreviewModel(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): Readonly<SpatialPreviewModel> {
  if (!scenario?.scenarioId) throw new TypeError("scenarioId is required");
  if (!snapshot?.fingerprint) throw new TypeError("snapshot fingerprint is required");
  if (scenario.source?.snapshotFingerprint !== snapshot.fingerprint) {
    throw new TypeError("scenario source fingerprint must match the reviewed snapshot");
  }
  if (scenario.source?.designId !== snapshot.designId) {
    throw new TypeError("scenario design identity must match the reviewed snapshot");
  }
  if (!scenario.source?.pageIds?.includes(snapshot.pageId)) {
    throw new TypeError("scenario page identity must match the reviewed snapshot");
  }

  const review = buildScenarioReview(scenario, snapshot);
  const reviewedById = new Map(review.map((item) => [item.elementId, item]));

  const elements = snapshot.elements.map((element, index) => {
    const reviewed = reviewedById.get(element.id);
    const source = geometry(
      element.left,
      element.top,
      element.width,
      element.height,
      element.rotation,
      `elements[${index}].source`,
    );
    const candidate = reviewed
      ? geometry(
          reviewed.after.left,
          reviewed.after.top,
          reviewed.after.width,
          reviewed.after.height,
          reviewed.after.rotation,
          `elements[${index}].candidate`,
        )
      : { ...source };

    return {
      elementId: element.id,
      depth: reviewed ? 100 + index : index,
      source,
      candidate,
      changed: Boolean(reviewed),
    };
  });

  const changedIds = elements
    .filter((element) => element.changed)
    .map((element) => element.elementId);
  const relationships = changedIds.slice(1).map((elementId, index) => ({
    fromElementId: changedIds[index],
    toElementId: elementId,
    kind: "review-sequence" as const,
    advisoryOnly: true as const,
  }));

  return deepFreeze({
    version: 1,
    interpretation: "read-only-spatial-preview",
    scenarioId: scenario.scenarioId,
    sourceFingerprint: snapshot.fingerprint,
    branches: {
      source: "reviewed-source",
      candidate: "advisory-candidate",
    },
    elements,
    relationships,
    safety: {
      readOnly: true,
      autoApply: false,
      authoritative: false,
    },
  });
}

export function interpolateSpatialPreview(
  model: Readonly<SpatialPreviewModel>,
  progress: number,
): ReadonlyArray<{
  elementId: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  changed: boolean;
}> {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new TypeError("progress must be a finite number from 0 to 1");
  }

  return model.elements.map((element) => {
    const mix = (from: number, to: number) => Number((from + (to - from) * progress).toFixed(6));
    return Object.freeze({
      elementId: element.elementId,
      depth: element.depth,
      x: mix(element.source.x, element.candidate.x),
      y: mix(element.source.y, element.candidate.y),
      width: mix(element.source.width, element.candidate.width),
      height: mix(element.source.height, element.candidate.height),
      rotation: mix(element.source.rotation, element.candidate.rotation),
      changed: element.changed,
    });
  });
}
