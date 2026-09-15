import {
  validateApplyVerificationReceiptForReviewedSnapshot,
  type ApplyVerificationReceipt,
  type VerificationDesignSnapshot,
} from "./apply-verification";
import { HEX_64, sha256, type HoloForgeScenario } from "./scenario-contract";

export type ApplyAttestation = Readonly<{
  version: 1;
  scenarioId: string;
  scenarioFingerprint: string;
  receiptFingerprint: string;
  designId: string;
  pageId: string;
  sourceFingerprint: string;
  resultingFingerprint: string;
  changedElementIds: readonly string[];
  verification: "reviewed-apply-attested";
  safety: Readonly<{
    explicitUserApply: true;
    autoApply: false;
    authoritative: false;
    physicalActuation: false;
  }>;
  attestationFingerprint: string;
}>;

const ATTESTATION_KEYS = [
  "attestationFingerprint",
  "changedElementIds",
  "designId",
  "pageId",
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

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

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

function attestationBody({
  scenario,
  snapshot,
  receipt,
}: {
  scenario: HoloForgeScenario;
  snapshot: VerificationDesignSnapshot;
  receipt: ApplyVerificationReceipt;
}) {
  return deepFreeze({
    version: 1 as const,
    scenarioId: scenario.scenarioId,
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    receiptFingerprint: receipt.receiptFingerprint,
    designId: snapshot.designId!,
    pageId: snapshot.pageId,
    sourceFingerprint: snapshot.fingerprint,
    resultingFingerprint: receipt.resultingFingerprint,
    changedElementIds: [...receipt.changedElementIds],
    verification: "reviewed-apply-attested" as const,
    safety: {
      explicitUserApply: true as const,
      autoApply: false as const,
      authoritative: false as const,
      physicalActuation: false as const,
    },
  });
}

export async function createApplyAttestation({
  scenario,
  snapshot,
  receipt,
}: {
  scenario: HoloForgeScenario;
  snapshot: VerificationDesignSnapshot;
  receipt: ApplyVerificationReceipt;
}): Promise<ApplyAttestation> {
  if (!(await validateApplyVerificationReceiptForReviewedSnapshot(receipt, scenario, snapshot))) {
    throw new TypeError("reviewed snapshot apply verification is required before attestation");
  }
  if (!snapshot.designId?.trim()) throw new TypeError("trusted design identity is required");

  const body = attestationBody({ scenario, snapshot, receipt });
  return deepFreeze({
    ...body,
    attestationFingerprint: await sha256(body),
  });
}

export async function validateApplyAttestation(
  attestation: ApplyAttestation | unknown,
  {
    scenario,
    snapshot,
    receipt,
  }: {
    scenario: HoloForgeScenario;
    snapshot: VerificationDesignSnapshot;
    receipt: ApplyVerificationReceipt;
  },
): Promise<boolean> {
  try {
    if (!(await validateApplyVerificationReceiptForReviewedSnapshot(receipt, scenario, snapshot))) {
      return false;
    }
    const value = readExactDataObject(attestation, ATTESTATION_KEYS);
    if (!value) return false;
    if (value.version !== 1 || value.verification !== "reviewed-apply-attested") return false;

    for (const fingerprint of [
      value.scenarioFingerprint,
      value.receiptFingerprint,
      value.sourceFingerprint,
      value.resultingFingerprint,
      value.attestationFingerprint,
    ]) {
      if (typeof fingerprint !== "string" || !HEX_64.test(fingerprint)) return false;
    }
    if (typeof value.scenarioId !== "string" || !value.scenarioId.trim()) return false;
    if (typeof value.designId !== "string" || !value.designId.trim()) return false;
    if (typeof value.pageId !== "string" || !value.pageId.trim()) return false;

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

    const expectedBody = attestationBody({ scenario, snapshot, receipt });
    if (value.scenarioId !== expectedBody.scenarioId) return false;
    if (value.scenarioFingerprint !== expectedBody.scenarioFingerprint) return false;
    if (value.receiptFingerprint !== expectedBody.receiptFingerprint) return false;
    if (value.designId !== expectedBody.designId || value.pageId !== expectedBody.pageId) return false;
    if (value.sourceFingerprint !== expectedBody.sourceFingerprint) return false;
    if (value.resultingFingerprint !== expectedBody.resultingFingerprint) return false;
    if (
      changedElementIds.length !== expectedBody.changedElementIds.length ||
      changedElementIds.some((id, index) => id !== expectedBody.changedElementIds[index])
    ) {
      return false;
    }

    return value.attestationFingerprint === (await sha256(expectedBody));
  } catch {
    return false;
  }
}
