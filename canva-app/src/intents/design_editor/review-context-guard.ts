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
  if (!snapshot.designId?.trim()) throw new TypeError("trusted design identity is required");
  const resolved = trustedDesignId?.trim() || snapshot.designId;
  if (resolved !== snapshot.designId) {
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
    designId: snapshot.designId,
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
      reviewed.designId === snapshot.designId &&
      reviewed.trustedDesignId === resolvedTrustedDesignId &&
      reviewed.pageId === snapshot.pageId &&
      reviewed.sourceFingerprint === snapshot.fingerprint
    );
  } catch {
    return false;
  }
}
