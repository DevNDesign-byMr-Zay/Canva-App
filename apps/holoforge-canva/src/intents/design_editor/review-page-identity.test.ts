import { describe, expect, it } from "vitest";

import type { ApplyAttestation } from "./apply-attestation";
import type { VerificationDesignSnapshot } from "./apply-verification";
import {
  createReviewedApplyContext,
  isApplyProofCurrentForReview,
  isReviewedApplyContextCurrent,
} from "./review-context-guard";
import type { HoloForgeScenario } from "./scenario-contract";

const scenario = {
  scenarioId: "scenario-page",
  provenance: { scenarioFingerprint: "a".repeat(64) },
} as HoloForgeScenario;

const snapshot = {
  designId: "design-1",
  pageId: "page-1",
  fingerprint: "b".repeat(64),
  pageDimensions: { width: 1200, height: 900 },
  elements: [],
} as VerificationDesignSnapshot;

const attestation = {
  version: 1,
  scenarioId: scenario.scenarioId,
  scenarioFingerprint: scenario.provenance.scenarioFingerprint,
  receiptFingerprint: "c".repeat(64),
  designId: "design-1",
  pageId: "page-1",
  sourceFingerprint: snapshot.fingerprint,
  resultingFingerprint: "d".repeat(64),
  changedElementIds: ["element-1"],
  verification: "reviewed-apply-attested",
  safety: {
    explicitUserApply: true,
    autoApply: false,
    authoritative: false,
    physicalActuation: false,
  },
  attestationFingerprint: "e".repeat(64),
} as ApplyAttestation;

describe("reviewed apply page identity", () => {
  it("binds the reviewed context to an explicit trusted page target", () => {
    const context = createReviewedApplyContext({
      scenario,
      snapshot,
      trustedDesignId: "design-1",
      trustedPageId: "page-1",
    });

    expect(context.trustedPageId).toBe("page-1");
    expect(
      isReviewedApplyContextCurrent(context, {
        scenario,
        snapshot,
        trustedDesignId: "design-1",
        trustedPageId: "page-1",
      }),
    ).toBe(true);
  });

  it("rejects an explicit page target that differs from the reviewed snapshot", () => {
    expect(() =>
      createReviewedApplyContext({
        scenario,
        snapshot,
        trustedDesignId: "design-1",
        trustedPageId: "page-2",
      }),
    ).toThrow(/trusted page target/);
  });

  it("invalidates in-flight context when the trusted page changes", () => {
    const context = createReviewedApplyContext({
      scenario,
      snapshot,
      trustedDesignId: "design-1",
      trustedPageId: "page-1",
    });

    expect(
      isReviewedApplyContextCurrent(context, {
        scenario,
        snapshot,
        trustedDesignId: "design-1",
        trustedPageId: "page-2",
      }),
    ).toBe(false);
  });

  it("keeps proof only while the optional trusted page matches the attested page", () => {
    expect(
      isApplyProofCurrentForReview(attestation, {
        scenario,
        trustedDesignId: "design-1",
        trustedPageId: "page-1",
      }),
    ).toBe(true);
    expect(
      isApplyProofCurrentForReview(attestation, {
        scenario,
        trustedDesignId: "design-1",
        trustedPageId: "page-2",
      }),
    ).toBe(false);
  });
});
