import type { ApplyAttestation } from "./apply-attestation";
import type { VerificationDesignSnapshot } from "./apply-verification";
import type { HoloForgeScenario } from "./scenario-contract";

export type ReviewedApplyContext = Readonly<{
  scenarioId: string;
  scenarioFingerprint: string;
  designId: string;
  trustedDesignId: string;
  pageId: string;
  trustedPageId: string;
  sourceFingerprint: string;
}>;

function resolveTrustedDesignId(
  snapshot: VerificationDesignSnapshot,
  trustedDesignId?: string,
): string {
  const snapshotDesignId = snapshot.designId?.trim();
  if (!snapshotDesignId) throw new TypeError("trusted design identity is required");
  const resolved = trustedDesignId?.trim() || snapshotDesignId;
  if (resolved !== snapshotDesignId) {
    throw new TypeError("reviewed snapshot does not match the trusted design target");
  }
  return resolved;
}

function resolveTrustedPageId(
  snapshot: VerificationDesignSnapshot,
  trustedPageId?: string,
): string {
  const snapshotPageId = snapshot.pageId?.trim();
  if (!snapshotPageId) throw new TypeError("trusted page identity is required");
  const resolved = trustedPageId?.trim() || snapshotPageId;
  if (resolved !== snapshotPageId) {
    throw new TypeError("reviewed snapshot does not match the trusted page target");
  }
  return resolved;
}

export function createReviewedApplyContext({
  scenario,
  snapshot,
  trustedDesignId,
  trustedPageId,
}: {
  scenario: HoloForgeScenario;
  snapshot: VerificationDesignSnapshot;
  trustedDesignId?: string;
  trustedPageId?: string;
}): ReviewedApplyContext {
  const resolvedTrustedDesignId = resolveTrustedDesignId(snapshot, trustedDesignId);
  const resolvedTrustedPageId = resolveTrustedPageId(snapshot, trustedPageId);

  return Object.freeze({
    scenarioId: scenario.scenarioId,
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    designId: resolvedTrustedDesignId,
    trustedDesignId: resolvedTrustedDesignId,
    pageId: resolvedTrustedPageId,
    trustedPageId: resolvedTrustedPageId,
    sourceFingerprint: snapshot.fingerprint,
  });
}

export function isReviewedApplyContextCurrent(
  reviewed: ReviewedApplyContext,
  {
    scenario,
    snapshot,
    trustedDesignId,
    trustedPageId,
  }: {
    scenario: HoloForgeScenario;
    snapshot: VerificationDesignSnapshot;
    trustedDesignId?: string;
    trustedPageId?: string;
  },
): boolean {
  try {
    const resolvedTrustedDesignId = resolveTrustedDesignId(snapshot, trustedDesignId);
    const resolvedTrustedPageId = resolveTrustedPageId(snapshot, trustedPageId);
    return (
      reviewed.scenarioId === scenario.scenarioId &&
      reviewed.scenarioFingerprint === scenario.provenance.scenarioFingerprint &&
      reviewed.designId === resolvedTrustedDesignId &&
      reviewed.trustedDesignId === resolvedTrustedDesignId &&
      reviewed.pageId === resolvedTrustedPageId &&
      reviewed.trustedPageId === resolvedTrustedPageId &&
      reviewed.sourceFingerprint === snapshot.fingerprint
    );
  } catch {
    return false;
  }
}

export function isApplyProofCurrentForReview(
  attestation: ApplyAttestation,
  {
    scenario,
    trustedDesignId,
    trustedPageId,
  }: {
    scenario?: HoloForgeScenario | null;
    trustedDesignId?: string;
    trustedPageId?: string;
  },
): boolean {
  if (!scenario) return false;
  const normalizedTrustedDesignId = trustedDesignId?.trim();
  const normalizedTrustedPageId = trustedPageId?.trim();
  return (
    attestation.scenarioId === scenario.scenarioId &&
    attestation.scenarioFingerprint === scenario.provenance.scenarioFingerprint &&
    (!normalizedTrustedDesignId || attestation.designId === normalizedTrustedDesignId) &&
    (!normalizedTrustedPageId || attestation.pageId === normalizedTrustedPageId)
  );
}
