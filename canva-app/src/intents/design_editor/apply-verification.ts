import {
  HEX_64,
  hasCanonicalProvenance,
  isCanvaWritableTransform,
  sha256,
  type HoloForgeScenario,
} from "./scenario-contract";

export type VerificationElementSnapshot = {
  id: string;
  type: string;
  top: number;
  left: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
};

export type VerificationDesignSnapshot = {
  designId?: string;
  pageId: string;
  pageDimensions: { width: number; height: number };
  elements: VerificationElementSnapshot[];
  fingerprint: string;
};

export type ApplyVerificationReceipt = Readonly<{
  version: 1;
  scenarioId: string;
  scenarioFingerprint: string;
  sourceFingerprint: string;
  expectedFingerprint: string;
  resultingFingerprint: string;
  changedElementIds: readonly string[];
  verification: "post-apply-match";
  safety: Readonly<{
    explicitUserApply: true;
    autoApply: false;
    authoritative: false;
    physicalActuation: false;
  }>;
  receiptFingerprint: string;
}>;

const RECEIPT_KEYS = [
  "changedElementIds",
  "expectedFingerprint",
  "receiptFingerprint",
  "resultingFingerprint",
  "safety",
  "scenarioFingerprint",
  "scenarioId",
  "sourceFingerprint",
  "verification",
  "version",
].sort();

const SAFETY_KEYS = ["authoritative", "autoApply", "explicitUserApply", "physicalActuation"].sort();

function readExactDataObject(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Object.keys(descriptors).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length ||
    actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    return null;
  }

  const copy: Record<string, unknown> = {};
  for (const key of sortedExpected) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
      return null;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function readExactStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const allowedKeys = new Set(["length"]);
  const copy: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || "get" in descriptor || "set" in descriptor) return null;
    if (typeof descriptor.value !== "string" || !descriptor.value.trim()) return null;
    copy.push(descriptor.value);
  }

  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowedKeys.has(key))) {
    return null;
  }
  if (copy.length === 0 || new Set(copy).size !== copy.length) return null;
  return copy;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function sameElementScope(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function hasUniqueSnapshotElementIds(elements: readonly VerificationElementSnapshot[]): boolean {
  const ids = new Set<string>();
  for (const element of elements) {
    if (!element.id || ids.has(element.id)) return false;
    ids.add(element.id);
  }
  return true;
}

async function fingerprintReviewedSnapshot(snapshot: VerificationDesignSnapshot): Promise<string> {
  return sha256({
    designId: snapshot.designId ?? null,
    pageId: snapshot.pageId,
    pageDimensions: snapshot.pageDimensions,
    elements: snapshot.elements,
  });
}

export async function projectExpectedPostApplyFingerprint(
  snapshot: VerificationDesignSnapshot,
  scenario: HoloForgeScenario,
): Promise<string> {
  if (!snapshot.designId?.trim()) throw new TypeError("trusted design identity is required");
  if (!HEX_64.test(snapshot.fingerprint)) {
    throw new TypeError("reviewed snapshot fingerprint must be a SHA-256 fingerprint");
  }
  if ((await fingerprintReviewedSnapshot(snapshot)) !== snapshot.fingerprint) {
    throw new TypeError("reviewed snapshot contents no longer match its trusted fingerprint");
  }
  if (scenario.source.snapshotFingerprint !== snapshot.fingerprint) {
    throw new TypeError("scenario source fingerprint does not match the reviewed snapshot");
  }
  if (!hasUniqueSnapshotElementIds(snapshot.elements)) {
    throw new TypeError("reviewed snapshot element identities must be unique");
  }
  if (
    new Set(scenario.candidate.changedElementIds).size !==
    scenario.candidate.changedElementIds.length
  ) {
    throw new TypeError("changed element identities must be unique");
  }

  const elements = snapshot.elements.map((element) => ({ ...element }));
  const byId = new Map(elements.map((element) => [element.id, element] as const));

  for (const elementId of scenario.candidate.changedElementIds) {
    const element = byId.get(elementId);
    const transform = scenario.candidate.layout.elements[elementId];
    if (!element || element.locked || !transform || !isCanvaWritableTransform(transform)) {
      throw new TypeError(`scenario cannot be projected onto element: ${elementId}`);
    }
    if (transform.x !== undefined) element.left = transform.x;
    if (transform.y !== undefined) element.top = transform.y;
    if (transform.rotation !== undefined) element.rotation = transform.rotation;
  }

  return sha256({
    designId: snapshot.designId,
    pageId: snapshot.pageId,
    pageDimensions: snapshot.pageDimensions,
    elements,
  });
}

export async function createApplyVerificationReceipt({
  scenario,
  sourceFingerprint,
  expectedFingerprint,
  resultingFingerprint,
  changedElementIds,
}: {
  scenario: HoloForgeScenario;
  sourceFingerprint: string;
  expectedFingerprint: string;
  resultingFingerprint: string;
  changedElementIds: string[];
}): Promise<ApplyVerificationReceipt> {
  if (!(await hasCanonicalProvenance(scenario))) {
    throw new TypeError("scenario provenance is not canonical");
  }
  if (!sameElementScope(changedElementIds, scenario.candidate.changedElementIds)) {
    throw new TypeError("verification receipt element scope does not match the scenario");
  }
  for (const [name, value] of Object.entries({
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    sourceFingerprint,
    expectedFingerprint,
    resultingFingerprint,
  })) {
    if (!HEX_64.test(value)) throw new TypeError(`${name} must be a SHA-256 fingerprint`);
  }
  if (sourceFingerprint !== scenario.source.snapshotFingerprint) {
    throw new TypeError("verification receipt source does not match the reviewed scenario");
  }
  if (expectedFingerprint !== resultingFingerprint) {
    throw new Error("Canva post-apply state does not match the reviewed expected state");
  }
  if (
    changedElementIds.length === 0 ||
    new Set(changedElementIds).size !== changedElementIds.length ||
    changedElementIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    throw new TypeError("changed element identities must be non-empty and unique");
  }

  const body = deepFreeze({
    version: 1 as const,
    scenarioId: scenario.scenarioId,
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    sourceFingerprint,
    expectedFingerprint,
    resultingFingerprint,
    changedElementIds: [...changedElementIds],
    verification: "post-apply-match" as const,
    safety: {
      explicitUserApply: true as const,
      autoApply: false as const,
      authoritative: false as const,
      physicalActuation: false as const,
    },
  });

  return deepFreeze({
    ...body,
    receiptFingerprint: await sha256(body),
  });
}

export async function validateApplyVerificationReceipt(
  receipt: ApplyVerificationReceipt | unknown,
): Promise<boolean> {
  try {
    const value = readExactDataObject(receipt, RECEIPT_KEYS);
    if (!value) return false;
    if (value.version !== 1 || value.verification !== "post-apply-match") return false;
    if (typeof value.scenarioId !== "string" || !value.scenarioId) return false;

    const scenarioFingerprint = value.scenarioFingerprint;
    const sourceFingerprint = value.sourceFingerprint;
    const expectedFingerprint = value.expectedFingerprint;
    const resultingFingerprint = value.resultingFingerprint;
    const receiptFingerprint = value.receiptFingerprint;
    for (const fingerprint of [
      scenarioFingerprint,
      sourceFingerprint,
      expectedFingerprint,
      resultingFingerprint,
      receiptFingerprint,
    ]) {
      if (typeof fingerprint !== "string" || !HEX_64.test(fingerprint)) return false;
    }
    if (expectedFingerprint !== resultingFingerprint) return false;

    const changedElementIds = readExactStringArray(value.changedElementIds);
    if (!changedElementIds) return false;

    const safety = readExactDataObject(value.safety, SAFETY_KEYS);
    if (!safety) return false;
    if (
      safety.explicitUserApply !== true ||
      safety.autoApply !== false ||
      safety.authoritative !== false ||
      safety.physicalActuation !== false
    ) {
      return false;
    }

    const body = {
      version: 1 as const,
      scenarioId: value.scenarioId,
      scenarioFingerprint,
      sourceFingerprint,
      expectedFingerprint,
      resultingFingerprint,
      changedElementIds,
      verification: "post-apply-match" as const,
      safety: {
        explicitUserApply: true as const,
        autoApply: false as const,
        authoritative: false as const,
        physicalActuation: false as const,
      },
    };
    return receiptFingerprint === (await sha256(body));
  } catch {
    return false;
  }
}

export async function validateApplyVerificationReceiptForScenario(
  receipt: ApplyVerificationReceipt | unknown,
  scenario: HoloForgeScenario,
): Promise<boolean> {
  try {
    if (!(await validateApplyVerificationReceipt(receipt))) return false;
    if (!(await hasCanonicalProvenance(scenario))) return false;

    const value = readExactDataObject(receipt, RECEIPT_KEYS);
    if (!value) return false;
    const changedElementIds = readExactStringArray(value.changedElementIds);
    if (!changedElementIds) return false;

    return (
      value.scenarioId === scenario.scenarioId &&
      value.scenarioFingerprint === scenario.provenance.scenarioFingerprint &&
      value.sourceFingerprint === scenario.source.snapshotFingerprint &&
      sameElementScope(changedElementIds, scenario.candidate.changedElementIds)
    );
  } catch {
    return false;
  }
}

export async function validateApplyVerificationReceiptForReviewedSnapshot(
  receipt: ApplyVerificationReceipt | unknown,
  scenario: HoloForgeScenario,
  snapshot: VerificationDesignSnapshot,
): Promise<boolean> {
  try {
    if (!(await validateApplyVerificationReceiptForScenario(receipt, scenario))) return false;
    if (!snapshot.designId?.trim()) return false;
    if (!HEX_64.test(snapshot.fingerprint)) return false;
    if ((await fingerprintReviewedSnapshot(snapshot)) !== snapshot.fingerprint) return false;
    if (snapshot.fingerprint !== scenario.source.snapshotFingerprint) return false;
    if (snapshot.designId !== scenario.source.designId) return false;
    if (!scenario.source.pageIds.includes(snapshot.pageId)) return false;

    const value = readExactDataObject(receipt, RECEIPT_KEYS);
    if (!value) return false;
    const expectedFingerprint = await projectExpectedPostApplyFingerprint(snapshot, scenario);

    return (
      value.sourceFingerprint === snapshot.fingerprint &&
      value.expectedFingerprint === expectedFingerprint &&
      value.resultingFingerprint === expectedFingerprint
    );
  } catch {
    return false;
  }
}
