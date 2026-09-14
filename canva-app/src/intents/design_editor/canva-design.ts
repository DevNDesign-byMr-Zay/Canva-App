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
  pageId: string;
  pageType: "absolute";
  pageDimensions: { width: number; height: number };
  elements: CanvaElementSnapshot[];
  fingerprint: string;
};

type CandidateElementTransform = {
  elementId: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  rotation?: number;
};

type HoloForgeScenario = {
  scenarioId: string;
  source: {
    designId: string;
    snapshotId: string;
    snapshotFingerprint: string;
  };
  candidate: {
    changedElementIds: string[];
    layout: {
      elements?: CandidateElementTransform[];
    };
  };
  evidence: {
    status: string;
    hardConstraintsPassed: boolean;
  };
  presentation: {
    advisoryOnly: boolean;
    autoApply: boolean;
    target: string;
  };
  provenance: {
    scenarioFingerprint: string;
    optimizationFingerprint: string;
  };
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

function snapshotElements(elements: SnapshotElementInput[]): CanvaElementSnapshot[] {
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
  pageId,
  pageDimensions,
  elements,
}: Pick<CanvaDesignSnapshot, "pageId" | "pageDimensions" | "elements">) {
  return sha256({ pageId, pageDimensions, elements });
}

export async function readCurrentDesignSnapshot(): Promise<CanvaDesignSnapshot> {
  const [{ title }, pageMetadata] = await Promise.all([
    getDesignMetadata(),
    getCurrentPageMetadata(),
  ]);

  if (pageMetadata.type !== "absolute" || !pageMetadata.id || !pageMetadata.dimensions) {
    throw new Error("HoloForge currently requires an absolute Canva page with stable dimensions.");
  }

  let elements: CanvaElementSnapshot[] = [];

  await openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.id !== pageMetadata.id) {
      throw new Error("The current Canva page changed while HoloForge was reading it.");
    }

    elements = snapshotElements(session.page.elements.toArray());
  });

  const fingerprint = await fingerprintPage({
    pageId: pageMetadata.id,
    pageDimensions: pageMetadata.dimensions,
    elements,
  });

  return {
    designTitle: title,
    pageId: pageMetadata.id,
    pageType: "absolute",
    pageDimensions: pageMetadata.dimensions,
    elements,
    fingerprint,
  };
}

export function canApplyScenario(
  scenario: HoloForgeScenario | null | undefined,
  snapshot: CanvaDesignSnapshot | null | undefined,
): boolean {
  if (!scenario || !snapshot) return false;
  if (!scenario.scenarioId || !scenario.source?.designId || !scenario.source.snapshotId) return false;
  if (!HEX_64.test(scenario.source.snapshotFingerprint)) return false;
  if (!HEX_64.test(scenario.provenance?.scenarioFingerprint ?? "")) return false;
  if (!HEX_64.test(scenario.provenance?.optimizationFingerprint ?? "")) return false;
  if (scenario.source.snapshotFingerprint !== snapshot.fingerprint) return false;
  if (scenario.evidence.status !== "complete" || scenario.evidence.hardConstraintsPassed !== true) {
    return false;
  }
  if (scenario.presentation.advisoryOnly !== true || scenario.presentation.autoApply !== false) {
    return false;
  }
  if (scenario.presentation.target !== "web-dashboard") return false;

  const transforms = scenario.candidate.layout.elements;
  const changedElementIds = scenario.candidate.changedElementIds;
  if (!Array.isArray(transforms) || transforms.length === 0) return false;
  if (!Array.isArray(changedElementIds) || changedElementIds.length === 0) return false;

  const knownIds = new Set(snapshot.elements.map(({ id }) => id));
  const transformIds = transforms.map(({ elementId }) => elementId);
  if (new Set(transformIds).size !== transformIds.length) return false;
  if (new Set(changedElementIds).size !== changedElementIds.length) return false;
  if (
    transformIds.length !== changedElementIds.length ||
    transformIds.some((elementId) => !changedElementIds.includes(elementId))
  ) {
    return false;
  }

  return transforms.every(({ elementId, top, left, width, height, rotation }) => {
    if (!knownIds.has(elementId)) return false;
    if (width !== undefined || height !== undefined) return false;
    return [top, left, rotation].every((value) => value === undefined || Number.isFinite(value));
  });
}

export async function applyScenario(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): Promise<{ scenarioId: string; changedElementIds: string[] }> {
  if (!canApplyScenario(scenario, snapshot)) {
    throw new Error("Scenario is not safe to apply: it is stale, incomplete, unsupported, or unverified.");
  }

  const transforms = scenario.candidate.layout.elements!;

  await openDesign({ type: "current_page" }, async (session) => {
    if (
      session.page.type !== "absolute" ||
      session.page.locked ||
      session.page.id !== snapshot.pageId
    ) {
      throw new Error("The Canva page is no longer compatible with the selected scenario.");
    }

    const liveElements = session.page.elements.toArray();
    const liveSnapshots = snapshotElements(liveElements);
    const liveFingerprint = await fingerprintPage({
      pageId: snapshot.pageId,
      pageDimensions: snapshot.pageDimensions,
      elements: liveSnapshots,
    });
    if (liveFingerprint !== snapshot.fingerprint) {
      throw new Error("The Canva design changed after this scenario was reviewed. Refresh before applying.");
    }

    const elements = new Map(
      liveSnapshots.map((elementSnapshot, index) => [elementSnapshot.id, liveElements[index]]),
    );

    for (const transform of transforms) {
      const element = elements.get(transform.elementId);
      if (!element || element.locked || element.type === "unsupported") {
        throw new Error(`Scenario references an unavailable element: ${transform.elementId}`);
      }

      if (transform.top !== undefined) element.top = transform.top;
      if (transform.left !== undefined) element.left = transform.left;
      if (transform.rotation !== undefined) element.rotation = transform.rotation;
    }

    // One sync = one coherent Canva undo action for the selected scenario.
    await session.sync();
  });

  return {
    scenarioId: scenario.scenarioId,
    changedElementIds: transforms.map(({ elementId }) => elementId),
  };
}
