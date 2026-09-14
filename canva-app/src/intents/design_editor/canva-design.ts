import { getCurrentPageMetadata, getDesignMetadata, openDesign } from "@canva/design";

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

type CanonicalCandidateElement = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  locked?: boolean;
};

type HoloForgeScenario = {
  contractVersion: 1;
  scenarioId: string;
  source: {
    designId: string;
    snapshotId: string;
    pageIds: string[];
    snapshotFingerprint: string;
  };
  intent: {
    summary: string;
    objectiveId: string;
    objectiveDirection: "maximize" | "minimize";
  };
  constraints: { hard: unknown[]; soft: unknown[] };
  candidate: {
    layout: { elements: Record<string, CanonicalCandidateElement> };
    changedElementIds: string[];
    delta: Record<string, unknown>;
  };
  evidence: {
    backend: string;
    algorithm: string;
    seed: string;
    status: string;
    objectiveScore: number;
    baseline: { backend: string; algorithm: string; objectiveScore: number };
    objectiveGap: number;
    durationMs: number;
    hardConstraintsPassed: boolean;
    warnings: string[];
  };
  interpretation: {
    producer: string;
    label: string;
    summary: string;
    tradeoffs: string[];
  };
  presentation: {
    advisoryOnly: true;
    autoApply: false;
    target: "web-dashboard";
  };
  provenance: {
    scenarioFingerprint: string;
    optimizationFingerprint: string;
  };
};

const HEX_64 = /^[a-f0-9]{64}$/;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalConstraintSet(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((constraint) => canonical(constraint))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

async function computeOptimizationFingerprint(scenario: HoloForgeScenario): Promise<string> {
  return sha256({
    sourceSnapshotFingerprint: scenario.source.snapshotFingerprint,
    objective: {
      id: scenario.intent.objectiveId,
      direction: scenario.intent.objectiveDirection,
    },
    constraints: {
      hard: canonicalConstraintSet(scenario.constraints.hard),
      soft: canonicalConstraintSet(scenario.constraints.soft),
    },
  });
}

async function computeScenarioFingerprint(scenario: HoloForgeScenario): Promise<string> {
  const unsigned = structuredClone(scenario) as HoloForgeScenario;
  delete unsigned.provenance.scenarioFingerprint;
  return sha256(unsigned);
}

async function hasCanonicalProvenance(scenario: HoloForgeScenario): Promise<boolean> {
  if (!HEX_64.test(scenario.provenance.scenarioFingerprint)) return false;
  if (!HEX_64.test(scenario.provenance.optimizationFingerprint)) return false;
  const [optimizationFingerprint, scenarioFingerprint] = await Promise.all([
    computeOptimizationFingerprint(scenario),
    computeScenarioFingerprint(scenario),
  ]);
  return optimizationFingerprint === scenario.provenance.optimizationFingerprint
    && scenarioFingerprint === scenario.provenance.scenarioFingerprint;
}

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

function isSafeTransform(value: CanonicalCandidateElement): boolean {
  return [value.x, value.y, value.width, value.height, value.rotation, value.scale]
    .every((number) => number === undefined || Number.isFinite(number))
    && (value.scale === undefined || value.scale > 0);
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
