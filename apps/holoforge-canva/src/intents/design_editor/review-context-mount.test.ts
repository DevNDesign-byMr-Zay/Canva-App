import { describe, expect, it, vi } from "vitest";

vi.mock("@canva/design", () => ({
  getDesignToken: vi.fn(),
}));

vi.mock("@canva/user", () => ({
  auth: {
    getCanvaUserToken: vi.fn(),
  },
}));

import type { TrustedReviewContext } from "./review-context-client";
import { loadProductionReviewContext, resolveReviewContextForMount } from "./review-context-mount";

function trustedContext(): TrustedReviewContext {
  return {
    scenario: {
      contractVersion: 1,
      scenarioId: "scenario-mount-1",
      source: {
        designId: "design-1",
        snapshotId: "snapshot-1",
        pageIds: ["page-1"],
        snapshotFingerprint: "a".repeat(64),
      },
      intent: {
        summary: "review layout",
        objectiveId: "balance",
        objectiveDirection: "maximize",
      },
      constraints: { hard: [], soft: [] },
      candidate: {
        layout: { elements: {} },
        changedElementIds: [],
        delta: {},
      },
      evidence: {
        backend: "reference",
        algorithm: "deterministic",
        seed: "seed-1",
        status: "complete",
        objectiveScore: 1,
        baseline: { backend: "reference", algorithm: "baseline", objectiveScore: 0 },
        objectiveGap: 1,
        durationMs: 1,
        hardConstraintsPassed: true,
        warnings: [],
      },
      interpretation: {
        producer: "upstream",
        label: "review",
        summary: "review candidate",
        tradeoffs: [],
      },
      presentation: {
        advisoryOnly: true,
        autoApply: false,
        target: "web-dashboard",
      },
      provenance: {
        scenarioFingerprint: "b".repeat(64),
        optimizationFingerprint: "c".repeat(64),
      },
    },
    trustedDesignId: "design-1",
    trustedPageId: "page-1",
  };
}

describe("production review-context mount", () => {
  it("targets the trusted backend review-context endpoint", async () => {
    const expected = trustedContext();
    const loadContext = vi.fn(async (options) => {
      expect(options.endpoint).toBe("https://backend.example/review-context");
      expect(typeof options.getDesignToken).toBe("function");
      expect(typeof options.getUserToken).toBe("function");
      return expected;
    });

    await expect(
      loadProductionReviewContext({
        backendHost: " https://backend.example/ ",
        loadContext,
      }),
    ).resolves.toBe(expected);
    expect(loadContext).toHaveBeenCalledTimes(1);
  });

  it("fails before any backend client call when the backend host is unavailable", async () => {
    const loadContext = vi.fn();

    await expect(
      loadProductionReviewContext({
        backendHost: "   ",
        loadContext,
      }),
    ).rejects.toThrow(/backend host is unavailable/);
    expect(loadContext).not.toHaveBeenCalled();
  });

  it("keeps the production mount fail-closed when trusted context cannot be verified", async () => {
    const loadContext = vi.fn(async () => {
      throw new Error("invalid trusted review context");
    });

    await expect(
      resolveReviewContextForMount({
        backendHost: "https://backend.example",
        loadContext,
      }),
    ).resolves.toBeNull();
  });

  it("passes through only a successfully verified trusted context", async () => {
    const expected = trustedContext();

    await expect(
      resolveReviewContextForMount({
        backendHost: "https://backend.example",
        loadContext: async () => expected,
      }),
    ).resolves.toBe(expected);
  });
});
