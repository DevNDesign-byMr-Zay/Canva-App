import {
  HEX_64,
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

const SAFETY_KEYS = [
  "authoritative",
  "autoApply",
  "explicitUserApply",
  "physicalActuation",
].sort();

function sameKeys(value: object, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

export async function projectExpectedPostApplyFingerprint(
  snapshot: VerificationDesignSnapshot,
  scenario: HoloForgeScenario,
): Promise<string> {
  if (!snapshot.designId?.trim()) throw new TypeError("trusted design identity is required");
  if (scenario.source.snapshotFingerprint !== snapshot.fingerprint) {
    throw new TypeError("scenario source fingerprint does not match the reviewed snapshot");
  }
  if (new Set(scenario.candidate.changedElementIds).size !== scenario.candidate.changedElementIds.length) {
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
  for (const [name, value] of Object.entries({
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    sourceFingerprint,
    expectedFingerprint,
    resultingFingerprint,
  })) {
    if (!HEX_64.test(value)) throw new TypeError(`${name} must be a SHA-256 fingerprint`);
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
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
    const value = receipt as ApplyVerificationReceipt;
    if (!sameKeys(value, RECEIPT_KEYS)) return false;
    if (value.version !== 1 || value.verification !== "post-apply-match") return false;
    if (!value.scenarioId || typeof value.scenarioId !== "string") return false;
    for (const fingerprint of [
      value.scenarioFingerprint,
      value.sourceFingerprint,
      value.expectedFingerprint,
      value.resultingFingerprint,
      value.receiptFingerprint,
    ]) {
      if (!HEX_64.test(fingerprint)) return false;
    }
    if (value.expectedFingerprint !== value.resultingFingerprint) return false;
    if (
      !Array.isArray(value.changedElementIds) ||
      value.changedElementIds.length === 0 ||
      new Set(value.changedElementIds).size !== value.changedElementIds.length ||
      value.changedElementIds.some((id) => typeof id !== "string" || !id.trim())
    ) {
      return false;
    }
    if (!value.safety || typeof value.safety !== "object" || !sameKeys(value.safety, SAFETY_KEYS)) {
      return false;
    }
    if (
      value.safety.explicitUserApply !== true ||
      value.safety.autoApply !== false ||
      value.safety.authoritative !== false ||
      value.safety.physicalActuation !== false
    ) {
      return false;
    }

    const { receiptFingerprint, ...body } = value;
    return receiptFingerprint === await sha256(body);
  } catch {
    return false;
  }
}
