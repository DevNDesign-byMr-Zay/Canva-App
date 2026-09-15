import type { VerificationDesignSnapshot } from "./apply-verification";
import type { HoloForgeScenario } from "./scenario-contract";

export type ReviewedApplyContext = Readonly<{
  scenarioId: string;
  scenarioFingerprint: string;
  designId: string;
  pageId: string;
  sourceFingerprint: string;
}>;

export function createReviewedApplyContext({
  scenario,
  snapshot,
}: {
  scenario: HoloForgeScenario;
  snapshot: VerificationDesignSnapshot;
}): ReviewedApplyContext {
  if (!snapshot.designId?.trim()) throw new TypeError("trusted design identity is required");

  return Object.freeze({
    scenarioId: scenario.scenarioId,
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    designId: snapshot.designId,
    pageId: snapshot.pageId,
    sourceFingerprint: snapshot.fingerprint,
  });
}

export function isReviewedApplyContextCurrent(
  reviewed: ReviewedApplyContext,
  {
    scenario,
    snapshot,
  }: {
    scenario: HoloForgeScenario;
    snapshot: VerificationDesignSnapshot;
  },
): boolean {
  return (
    reviewed.scenarioId === scenario.scenarioId &&
    reviewed.scenarioFingerprint === scenario.provenance.scenarioFingerprint &&
    reviewed.designId === snapshot.designId &&
    reviewed.pageId === snapshot.pageId &&
    reviewed.sourceFingerprint === snapshot.fingerprint
  );
}
