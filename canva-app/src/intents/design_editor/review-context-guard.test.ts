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
  it("accepts the exact scenario and reviewed snapshot context", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
    });

    expect(
      isReviewedApplyContextCurrent(context, {
        scenario: reviewedScenario,
        snapshot: reviewedSnapshot,
      }),
    ).toBe(true);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("rejects a scenario swap while apply is in flight", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
    });

    expect(
      isReviewedApplyContextCurrent(context, {
        scenario: scenario("scenario-2", "c".repeat(64)),
        snapshot: reviewedSnapshot,
      }),
    ).toBe(false);
  });

  it("rejects reviewed snapshot, page, or design drift", () => {
    const reviewedScenario = scenario();
    const reviewedSnapshot = snapshot();
    const context = createReviewedApplyContext({
      scenario: reviewedScenario,
      snapshot: reviewedSnapshot,
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
        }),
      ).toBe(false);
    }
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
