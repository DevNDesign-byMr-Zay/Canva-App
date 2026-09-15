import { describe, expect, it } from "vitest";

import type { VerificationDesignSnapshot } from "./apply-verification";
import {
  createReviewedApplyContext,
  isReviewedApplyContextCurrent,
} from "./review-context-guard";
import type { HoloForgeScenario } from "./scenario-contract";

function scenario(id = "scenario-1", fingerprint = "a".repeat(64)): HoloForgeScenario {
  return {
    scenarioId: id,
    provenance: { scenarioFingerprint: fingerprint },
  } as HoloForgeScenario;
}

function snapshot(overrides: Partial<VerificationDesignSnapshot> = {}): VerificationDesignSnapshot {
  return {
    designId: "design-1",
    pageId: "page-1",
    fingerprint: "b".repeat(64),
    pageDimensions: { width: 1200, height: 900 },
    elements: [],
    ...overrides,
  };
}

describe("reviewed apply context guard", () => {
  it("accepts the exact scenario, reviewed snapshot, and trusted design target", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
      trustedDesignId: "design-1",
    });

    expect(
      isReviewedApplyContextCurrent(context, {
        scenario: reviewedScenario,
        snapshot: reviewedSnapshot,
        trustedDesignId: "design-1",
      }),
    ).toBe(true);
    expect(context.trustedDesignId).toBe("design-1");
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("rejects a scenario swap while apply is in flight", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
      trustedDesignId: "design-1",
    });

    expect(
      isReviewedApplyContextCurrent(context, {
        scenario: scenario("scenario-2", "c".repeat(64)),
        snapshot: reviewedSnapshot,
        trustedDesignId: "design-1",
      }),
    ).toBe(false);
  });

  it("rejects reviewed snapshot, page, or design drift", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
      trustedDesignId: "design-1",
    });

    for (const changedSnapshot of [
      snapshot({ fingerprint: "d".repeat(64) }),
      snapshot({ pageId: "page-2" }),
      snapshot({ designId: "design-2" }),
    ]) {
      expect(
        isReviewedApplyContextCurrent(context, {
          scenario: reviewedScenario,
          snapshot: changedSnapshot,
          trustedDesignId: changedSnapshot.designId,
        }),
      ).toBe(false);
    }
  });

  it("rejects trusted design target drift even before a new snapshot is installed", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
      trustedDesignId: "design-1",
    });

    expect(
      isReviewedApplyContextCurrent(context, {
        scenario: reviewedScenario,
        snapshot: reviewedSnapshot,
        trustedDesignId: "design-2",
      }),
    ).toBe(false);
  });

  it("rejects a reviewed snapshot that does not match the trusted design target", () => {
    expect(() =>
      createReviewedApplyContext({
        scenario: scenario(),
        snapshot: snapshot({ designId: "design-1" }),
        trustedDesignId: "design-2",
      }),
    ).toThrow(/does not match the trusted design target/);
  });

  it("falls back to the reviewed snapshot identity when no explicit target is provided", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
    });

    expect(context.trustedDesignId).toBe("design-1");
    expect(
      isReviewedApplyContextCurrent(context, {
        scenario: reviewedScenario,
        snapshot: reviewedSnapshot,
      }),
    ).toBe(true);
  });

  it("requires trusted design identity before an apply context can be captured", () => {
    expect(() =>
      createReviewedApplyContext({
        scenario: scenario(),
        snapshot: snapshot({ designId: undefined }),
      }),
    ).toThrow(/trusted design identity/);
  });
});
