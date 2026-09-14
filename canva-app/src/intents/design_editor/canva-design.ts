import { getCurrentPageMetadata, getDesignMetadata, openDesign } from "@canva/design";

import {
  HEX_64,
  computeScenarioFingerprint,
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

export async function readCurrentDesignSnapshot(options: { trustedDesignId?: string } = {}): Promise<CanvaDesignSnapshot> {
  const [{ title }, pageMetadata] = await Promise.all([getDesignMetadata(), getCurrentPageMetadata()]);
  if (pageMetadata.type !== "absolute" || !pageMetadata.id || !pageMetadata.dimensions) {
    throw new Error("HoloForge currently requires an absolute Canva page with stable dimensions.");
  }

  const designId = options.trustedDesignId?.trim() || undefined;
  let elements: CanvaElementSnapshot[] = [];
  await openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.id !== pageMetadata.id) {
      throw new Error("The current Canva page changed while HoloForge was reading it.");
    }
    elements = session.page.elements.toArray().map((element) => ({
      id: element.id,
      type: element.type,
      top: element.top,
      left: element.left,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      locked: element.locked,
    }));
  });

  const fingerprint = await sha256({
    designId: designId ?? null,
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

export async function canApplyScenario(
  scenario: HoloForgeScenario | null | undefined,
  snapshot: CanvaDesignSnapshot | null | undefined,
): Promise<boolean> {
  if (!scenario || !snapshot) return false;
  if (scenario.contractVersion !== 1) return false;
  if (!snapshot.designId || !scenario.scenarioId || !scenario.source?.designId || !scenario.source.snapshotId) return false;
  if (scenario.source.designId !== snapshot.designId) return false;
  if (!Array.isArray(scenario.source.pageIds) || !scenario.source.pageIds.includes(snapshot.pageId)) return false;
  if (!HEX_64.test(scenario.source.snapshotFingerprint)) return false;
  if (scenario.source.snapshotFingerprint !== snapshot.fingerprint) return false;
  if (scenario.evidence.status !== "complete" || scenario.evidence.hardConstraintsPassed !== true) return false;
  if (scenario.presentation.advisoryOnly !== true || scenario.presentation.autoApply !== false || scenario.presentation.target !== "web-dashboard") return false;
  if (!scenario.intent?.objectiveId || !scenario.intent?.objectiveDirection) return false;
  if (!Array.isArray(scenario.candidate.changedElementIds) || scenario.candidate.changedElementIds.length === 0) return false;
  if (!scenario.candidate.layout?.elements || typeof scenario.candidate.layout.elements !== "object") return false;

  const knownIds = new Set(snapshot.elements.map(({ id }) => id));
  const changedIds = scenarioTransformIds(scenario);
  if (changedIds.length !== scenario.candidate.changedElementIds.length) return false;
  if (!changedIds.every((id) => knownIds.has(id))) return false;
  if (!changedIds.every((id) => isSafeTransform(scenario.candidate.layout.elements[id]))) return false;

  return hasCanonicalProvenance(scenario);
}

async function currentFingerprint(session: { page: { type: string; id: string; dimensions?: { width: number; height: number }; elements: { toArray: () => Array<CanvaElementSnapshot> } } }, designId: string): Promise<string> {
  const elements = session.page.elements.toArray().map((element) => ({
    id: element.id,
    type: element.type,
    top: element.top,
    left: element.left,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    locked: element.locked,
  }));
  return sha256({
    designId,
    pageId: session.page.id,
    pageDimensions: session.page.dimensions,
    elements,
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

    const liveFingerprint = await currentFingerprint(session, snapshot.designId!);
    if (liveFingerprint !== scenario.source.snapshotFingerprint) {
      throw new Error("The Canva design changed after review. Read the current design again before applying.");
    }
    if (!(await hasCanonicalProvenance(scenario))) {
      throw new Error("The selected scenario provenance no longer matches its canonical fingerprints.");
    }

    const elements = new Map(session.page.elements.toArray().map((element) => [element.id, element]));
    for (const elementId of scenario.candidate.changedElementIds) {
      const transform = scenario.candidate.layout.elements[elementId];
      const element = elements.get(elementId);
      if (!transform || !element || element.locked || element.type === "unsupported") {
        throw new Error(`Scenario references an unavailable element: ${elementId}`);
      }
      if (transform.x !== undefined) element.left = transform.x;
      if (transform.y !== undefined) element.top = transform.y;
      if (transform.width !== undefined) element.width = transform.width;
      if (transform.height !== undefined) element.height = transform.height;
      if (transform.scale !== undefined) {
        element.width *= transform.scale;
        element.height *= transform.scale;
      }
      if (transform.rotation !== undefined) element.rotation = transform.rotation;
    }
    await session.sync();
  });

  return { scenarioId: scenario.scenarioId, changedElementIds: [...scenario.candidate.changedElementIds] };
}
