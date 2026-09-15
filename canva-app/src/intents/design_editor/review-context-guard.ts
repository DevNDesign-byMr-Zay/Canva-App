import type { ApplyAttestation } from "./apply-attestation";
import type { VerificationDesignSnapshot } from "./apply-verification";
import type { HoloForgeScenario } from "./scenario-contract";

export type ReviewedApplyContext = Readonly<{
  scenarioId: string;
  scenarioFingerprint: string;
  designId: string;
  trustedDesignId: string;
  pageId: string;
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

export function createReviewedApplyContext({
  scenario,
  snapshot,
  trustedDesignId,
}: {
  scenario: HoloForgeScenario;
  snapshot: VerificationDesignSnapshot;
  trustedDesignId?: string;
}): ReviewedApplyContext {
  const resolvedTrustedDesignId = resolveTrustedDesignId(snapshot, trustedDesignId);

  return Object.freeze({
    scenarioId: scenario.scenarioId,
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    designId: resolvedTrustedDesignId,
    trustedDesignId: resolvedTrustedDesignId,
    pageId: snapshot.pageId,
    sourceFingerprint: snapshot.fingerprint,
  });
}

export function isReviewedApplyContextCurrent(
  reviewed: ReviewedApplyContext,
  {
    scenario,
    snapshot,
    trustedDesignId,
  }: {
    scenario: HoloForgeScenario;
    snapshot: VerificationDesignSnapshot;
    trustedDesignId?: string;
  },
): boolean {
  try {
    const resolvedTrustedDesignId = resolveTrustedDesignId(snapshot, trustedDesignId);
    return (
      reviewed.scenarioId === scenario.scenarioId &&
      reviewed.scenarioFingerprint === scenario.provenance.scenarioFingerprint &&
      reviewed.designId === resolvedTrustedDesignId &&
      reviewed.trustedDesignId === resolvedTrustedDesignId &&
      reviewed.pageId === snapshot.pageId &&
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
  }: {
    scenario?: HoloForgeScenario | null;
    trustedDesignId?: string;
  },
): boolean {
  if (!scenario) return false;
  const normalizedTrustedDesignId = trustedDesignId?.trim();
  return (
    attestation.scenarioId === scenario.scenarioId &&
    attestation.scenarioFingerprint === scenario.provenance.scenarioFingerprint &&
    (!normalizedTrustedDesignId || attestation.designId === normalizedTrustedDesignId)
  );
}
