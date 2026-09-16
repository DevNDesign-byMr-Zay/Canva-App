import { describe, expect, it, vi } from "vitest";

import { loadTrustedReviewContext } from "./review-context-client";

const validScenario = {
  contractVersion: 1,
  scenarioId: "scenario-review-1",
  source: {
    designId: "design-1",
    snapshotId: "snapshot-1",
    pageIds: ["page-1"],
    snapshotFingerprint: "a".repeat(64),
  },
  intent: { summary: "review", objectiveId: "balance", objectiveDirection: "maximize" },
  constraints: { hard: [], soft: [] },
  candidate: { layout: { elements: {} }, changedElementIds: [], delta: {} },
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
  interpretation: { producer: "upstream", label: "review", summary: "review", tradeoffs: [] },
  presentation: { advisoryOnly: true, autoApply: false, target: "web-dashboard" },
  provenance: { scenarioFingerprint: "b".repeat(64), optimizationFingerprint: "c".repeat(64) },
};

const context = {
  scenario: validScenario,
  trustedDesignId: "design-1",
  trustedPageId: "page-1",
};

function fetchImpl() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => context,
  }));
}

describe("trusted review endpoint boundary", () => {
  it("normalizes a secure absolute endpoint before fetch", async () => {
    const fetch = fetchImpl();

    await loadTrustedReviewContext({
      endpoint: " https://backend.example/review-context ",
      getDesignToken: async () => ({ token: "design-token" }),
      getUserToken: async () => "user-token",
      fetchImpl,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://backend.example/review-context",
      expect.any(Object),
    );
  });

  it.each([
    ["relative", "/review-context", /absolute URL/],
    ["http", "http://backend.example/review-context", /HTTPS/],
    ["credentials", "https://user:pass@backend.example/review-context", /credentials/],
    ["fragment", "https://backend.example/review-context#token", /fragment/],
  ])("rejects %s endpoints before requesting tokens", async (_label, endpoint, message) => {
    const getDesignToken = vi.fn(async () => ({ token: "design-token" }));
    const getUserToken = vi.fn(async () => "user-token");
    const fetch = fetchImpl();

    await expect(
      loadTrustedReviewContext({
        endpoint,
        getDesignToken,
        getUserToken,
        fetchImpl: fetch,
      }),
    ).rejects.toThrow(message);

    expect(getDesignToken).not.toHaveBeenCalled();
    expect(getUserToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
