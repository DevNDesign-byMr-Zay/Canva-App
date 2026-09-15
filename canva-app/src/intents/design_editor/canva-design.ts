import { getCurrentPageMetadata, getDesignMetadata, openDesign } from "@canva/design";

import {
  createApplyVerificationReceipt,
  projectExpectedPostApplyFingerprint,
  type ApplyVerificationReceipt,
} from "./apply-verification";
import {
  HEX_64,
  hasCanonicalProvenance,
  hasUniqueChangedElementIds,
  isCanvaWritableTransform,
  sha256,
  type HoloForgeScenario,
} from "./scenario-contract";

export type { HoloForgeScenario } from "./scenario-contract";
export type { ApplyVerificationReceipt } from "./apply-verification";

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

type SnapshotFingerprintInput = {
  readonly designId?: string;
  readonly pageId: string;
  readonly pageDimensions: { readonly width: number; readonly height: number };
  readonly elements: readonly Readonly<CanvaElementSnapshot>[];
};

type ReadableAbsoluteElement = {
  readonly type: string;
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly locked: boolean;
};

type ReadableAbsolutePage = {
  readonly id: string;
  readonly dimensions?: { readonly width: number; readonly height: number };
  readonly elements: { toArray(): readonly ReadableAbsoluteElement[] };
};

class ReadonlyMapView<K, V> implements ReadonlyMap<K, V> {
  readonly #source: Map<K, V>;

  constructor(source: Map<K, V>) {
    this.#source = source;
    Object.freeze(this);
  }

  get size(): number {
    return this.#source.size;
  }

  get(key: K): V | undefined {
    return this.#source.get(key);
  }

  has(key: K): boolean {
    return this.#source.has(key);
  }

  entries(): MapIterator<[K, V]> {
    return this.#source.entries();
  }

  keys(): MapIterator<K> {
    return this.#source.keys();
  }

  values(): MapIterator<V> {
    return this.#source.values();
  }

  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
    this.#source.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#source[Symbol.iterator]();
  }
}

function snapshotElementId(index: number): string {
  return `element-${index + 1}`;
}

function freezeElementSnapshot(element: CanvaElementSnapshot): Readonly<CanvaElementSnapshot> {
  return Object.freeze({ ...element });
}

function snapshotElements(elements: readonly ReadableAbsoluteElement[]): CanvaElementSnapshot[] {
  return elements.map((element, index) => ({
    id: snapshotElementId(index),
    type: element.type,
    top: element.top,
    left: element.left,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    locked: element.locked,
  }));
}

export async function computeCanvaSnapshotFingerprint(
  snapshot: SnapshotFingerprintInput,
): Promise<string> {
  return sha256({
    designId: snapshot.designId ?? null,
    pageId: snapshot.pageId,
    pageDimensions: snapshot.pageDimensions,
    elements: snapshot.elements,
  });
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
    elements = snapshotElements(session.page.elements.toArray());
  });

  const fingerprint = await computeCanvaSnapshotFingerprint({
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

export function getReviewedElementBinding(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): ReadonlyMap<string, Readonly<CanvaElementSnapshot>> | null {
  const changedIds = scenario?.candidate?.changedElementIds;
  const layoutElements = scenario?.candidate?.layout?.elements;
  if (!Array.isArray(changedIds) || changedIds.length === 0 || !layoutElements || typeof layoutElements !== "object") {
    return null;
  }
  if (!hasUniqueChangedElementIds(scenario) || changedIds.some((id) => typeof id !== "string" || !id.trim())) {
    return null;
  }

  const snapshotIds = snapshot.elements.map(({ id }) => id);
  if (snapshotIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(snapshotIds).size !== snapshotIds.length) {
    return null;
  }

  const byId = new Map(
    snapshot.elements.map((element) => [element.id, freezeElementSnapshot(element)] as const),
  );
  const binding = new Map<string, Readonly<CanvaElementSnapshot>>();
  for (const scenarioElementId of changedIds) {
    const element = byId.get(scenarioElementId);
    if (!element || !layoutElements[scenarioElementId]) return null;
    binding.set(scenarioElementId, element);
  }
  return new ReadonlyMapView(binding);
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
  if (!hasUniqueChangedElementIds(scenario)) return false;
  if (!scenario.candidate.layout?.elements || typeof scenario.candidate.layout.elements !== "object") return false;

  const binding = getReviewedElementBinding(scenario, snapshot);
  if (!binding) return false;
  const changedIds = scenarioTransformIds(scenario);
  if (changedIds.length !== scenario.candidate.changedElementIds.length) return false;
  if (!changedIds.every((id) => binding.has(id))) return false;
  if (!changedIds.every((id) => isCanvaWritableTransform(scenario.candidate.layout.elements[id]))) return false;

  return hasCanonicalProvenance(scenario);
}

async function currentFingerprint(page: ReadableAbsolutePage, designId: string): Promise<string> {
  if (!page.dimensions) {
    throw new Error("The current Canva page no longer has stable dimensions.");
  }
  return computeCanvaSnapshotFingerprint({
    designId,
    pageId: page.id,
    pageDimensions: page.dimensions,
    elements: snapshotElements(page.elements.toArray()),
  });
}

export async function applyScenario(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): Promise<ApplyVerificationReceipt> {
  if (!(await canApplyScenario(scenario, snapshot))) {
    throw new Error("Scenario is not safe to apply: it is stale, incomplete, unsupported, or unverified.");
  }

  const expectedPostFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);
  let verificationReceipt: ApplyVerificationReceipt | null = null;

  await openDesign({ type: "current_page" }, async (session) => {
    if (session.page.type !== "absolute" || session.page.locked || session.page.id !== snapshot.pageId) {
      throw new Error("The Canva page is no longer compatible with the selected scenario.");
    }

    const liveFingerprint = await currentFingerprint(session.page, snapshot.designId!);
    if (liveFingerprint !== scenario.source.snapshotFingerprint) {
      throw new Error("The Canva design changed after review. Read the current design again before applying.");
    }
    if (!(await hasCanonicalProvenance(scenario))) {
      throw new Error("The selected scenario provenance no longer matches its canonical fingerprints.");
    }

    const elements = new Map(
      session.page.elements.toArray().map((element, index) => [snapshotElementId(index), element] as const),
    );
    for (const elementId of scenario.candidate.changedElementIds) {
      const transform = scenario.candidate.layout.elements[elementId];
      const element = elements.get(elementId);
      if (!transform || !isCanvaWritableTransform(transform) || !element || element.locked || element.type === "unsupported") {
        throw new Error(`Scenario references an unavailable or unsupported element: ${elementId}`);
      }
      if (transform.x !== undefined) element.left = transform.x;
      if (transform.y !== undefined) element.top = transform.y;
      if (transform.rotation !== undefined) element.rotation = transform.rotation;
    }
    await session.sync();

    const resultingFingerprint = await currentFingerprint(session.page, snapshot.designId!);
    verificationReceipt = await createApplyVerificationReceipt({
      scenario,
      sourceFingerprint: snapshot.fingerprint,
      expectedFingerprint: expectedPostFingerprint,
      resultingFingerprint,
      changedElementIds: [...scenario.candidate.changedElementIds],
    });
  });

  if (!verificationReceipt) {
    throw new Error("Canva apply completed without a verifiable postcondition receipt.");
  }
  return verificationReceipt;
}
