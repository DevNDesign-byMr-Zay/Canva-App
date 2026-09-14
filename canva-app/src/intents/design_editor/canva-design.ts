import { getCurrentPageMetadata, getDesignMetadata, openDesign } from "@canva/design";

import {
  HEX_64,
  hasCanonicalProvenance,
  isSafeTransform,
  sha256,
  type HoloForgeScenario,
} from "./scenario-contract";

export type { HoloForgeScenario } from "./scenario-contract";

export type CanvaElementSnapshot = {
  id: string;
  type: string;
  top: number;
  left: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
};

export type CanvaDesignSnapshot = {
  designTitle?: string;
  designId?: string;
  pageId: string;
  pageType: "absolute";
  pageDimensions: { width: number; height: number };
  elements: CanvaElementSnapshot[];
  fingerprint: string;
};

type SnapshotElementInput = {
  type: string;
  top: number;
  left: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
};

function snapshotElements(elements: readonly SnapshotElementInput[]): CanvaElementSnapshot[] {
  return elements.map((element, index) => ({
    id: `element-${index + 1}`,
    type: element.type,
    top: element.top,
    left: element.left,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    locked: element.locked,
  }));
}

async function fingerprintPage({
  designId,
  pageId,
  pageDimensions,
  elements,
}: {
  designId?: string;
  pageId: string;
  pageDimensions: { width: number; height: number };
  elements: readonly CanvaElementSnapshot[];
}): Promise<string> {
  return sha256({
    designId: designId ?? null,
    pageId,
    pageDimensions,
    elements,
  });
}

export async function readCurrentDesignSnapshot(
  options: { trustedDesignId?: string } = {},
): Promise<CanvaDesignSnapshot> {
  const [{ title }, pageMetadata] = await Promise.all([
    getDesignMetadata(),
    getCurrentPageMetadata(),
  ]);
  if (pageMetadata.type !== "absolute" || !pageMetadata.id || !pageMetadata.dimensions) {
    throw new Error("HoloForge currently requires an absolute Canva page with stable dimensions.");
  }

  const designId = options.trustedDesignId?.trim() || undefined;
  let elements: CanvaElementSnapshot[] = [];
  await openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.id !== pageMetadata.id) {
      throw new Error("The current Canva page changed while HoloForge was reading it.");
    }
    elements = snapshotElements(session.page.elements.toArray());
  });

  const fingerprint = await fingerprintPage({
    designId,
    pageId: pageMetadata.id,
    pageDimensions: pageMetadata.dimensions,
    elements,
  });
  return {
    designTitle: title,
    designId,
    pageId: pageMetadata.id,
    pageType: "absolute",
    pageDimensions: pageMetadata.dimensions,
    elements,
    fingerprint,
  };
}

function scenarioTransformIds(scenario: HoloForgeScenario): string[] {
  return scenario.candidate.changedElementIds.filter((id) => Boolean(scenario.candidate.layout.elements[id]));
}

function hasUnsupportedDimensionTransform(scenario: HoloForgeScenario): boolean {
  return scenario.candidate.changedElementIds.some((id) => {
    const transform = scenario.candidate.layout.elements[id];
    return Boolean(
      transform &&
        (transform.width !== undefined ||
          transform.height !== undefined ||
          transform.scale !== undefined),
    );
  });
}

export async function canApplyScenario(
  scenario: HoloForgeScenario | null | undefined,
  snapshot: CanvaDesignSnapshot | null | undefined,
): Promise<boolean> {
  if (!scenario || !snapshot) return false;
  if (scenario.contractVersion !== 1) return false;
  if (!snapshot.designId || !scenario.scenarioId || !scenario.source?.designId || !scenario.source.snapshotId) {
    return false;
  }
  if (scenario.source.designId !== snapshot.designId) return false;
  if (!Array.isArray(scenario.source.pageIds) || !scenario.source.pageIds.includes(snapshot.pageId)) return false;
  if (!HEX_64.test(scenario.source.snapshotFingerprint)) return false;
  if (scenario.source.snapshotFingerprint !== snapshot.fingerprint) return false;
  if (scenario.evidence.status !== "complete" || scenario.evidence.hardConstraintsPassed !== true) return false;
  if (
    scenario.presentation.advisoryOnly !== true ||
    scenario.presentation.autoApply !== false ||
    scenario.presentation.target !== "web-dashboard"
  ) {
    return false;
  }
  if (!scenario.intent?.objectiveId || !scenario.intent?.objectiveDirection) return false;
  if (!Array.isArray(scenario.candidate.changedElementIds) || scenario.candidate.changedElementIds.length === 0) return false;
  if (!scenario.candidate.layout?.elements || typeof scenario.candidate.layout.elements !== "object") return false;
  if (new Set(scenario.candidate.changedElementIds).size !== scenario.candidate.changedElementIds.length) return false;
  if (hasUnsupportedDimensionTransform(scenario)) return false;

  const knownIds = new Set(snapshot.elements.map(({ id }) => id));
  const changedIds = scenarioTransformIds(scenario);
  if (changedIds.length !== scenario.candidate.changedElementIds.length) return false;
  if (!changedIds.every((id) => knownIds.has(id))) return false;
  if (!changedIds.every((id) => isSafeTransform(scenario.candidate.layout.elements[id]))) return false;

  return hasCanonicalProvenance(scenario);
}

async function currentFingerprint(
  elements: readonly SnapshotElementInput[],
  snapshot: CanvaDesignSnapshot,
): Promise<string> {
  return fingerprintPage({
    designId: snapshot.designId,
    pageId: snapshot.pageId,
    pageDimensions: snapshot.pageDimensions,
    elements: snapshotElements(elements),
  });
}

export async function applyScenario(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): Promise<{ scenarioId: string; changedElementIds: string[] }> {
  if (!(await canApplyScenario(scenario, snapshot))) {
    throw new Error("Scenario is not safe to apply: it is stale, incomplete, unsupported, or unverified.");
  }

  await openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.locked || session.page.id !== snapshot.pageId) {
      throw new Error("The Canva page is no longer compatible with the selected scenario.");
    }

    const liveElements = session.page.elements.toArray();
    const liveFingerprint = await currentFingerprint(liveElements, snapshot);
    if (liveFingerprint !== scenario.source.snapshotFingerprint) {
      throw new Error("The Canva design changed after review. Read the current design again before applying.");
    }
    if (!(await hasCanonicalProvenance(scenario))) {
      throw new Error("The selected scenario provenance no longer matches its canonical fingerprints.");
    }

    const liveSnapshots = snapshotElements(liveElements);
    const elements = new Map(
      liveSnapshots.map((elementSnapshot, index) => [elementSnapshot.id, liveElements[index]]),
    );
    for (const elementId of scenario.candidate.changedElementIds) {
      const transform = scenario.candidate.layout.elements[elementId];
      const element = elements.get(elementId);
      if (!transform || !element || element.locked || element.type === "unsupported") {
        throw new Error(`Scenario references an unavailable element: ${elementId}`);
      }
      if (transform.x !== undefined) element.left = transform.x;
      if (transform.y !== undefined) element.top = transform.y;
      if (transform.rotation !== undefined) element.rotation = transform.rotation;
    }
    await session.sync();
  });

  return {
    scenarioId: scenario.scenarioId,
    changedElementIds: [...scenario.candidate.changedElementIds],
  };
}
