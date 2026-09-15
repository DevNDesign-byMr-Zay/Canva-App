import { describe, expect, it, vi } from "vitest";

import {
  loadTrustedReviewContext,
  type LoadTrustedReviewContextOptions,
} from "./review-context-client";
import type { HoloForgeScenario } from "./scenario-contract";

function scenario(overrides: Partial<HoloForgeScenario> = {}): HoloForgeScenario {
  return {
    contractVersion: 1,
    scenarioId: "scenario-review-1",
    source: {
      designId: "design-1",
      snapshotId: "snapshot-1",
      pageIds: ["page-1"],
      snapshotFingerprint: "a".repeat(64),
    },
    intent: {
      summary: "rebalance layout",
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
    ...overrides,
  };
}

type FetchImpl = NonNullable<LoadTrustedReviewContextOptions["fetchImpl"]>;

function successfulFetch(value: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => value,
  })) as unknown as FetchImpl;
}

describe("trusted review context client", () => {
  it("sends fresh design and user tokens together and returns a frozen trusted context", async () => {
    const getDesignToken = vi
      .fn()
      .mockResolvedValueOnce({ token: "design-token-1" })
      .mockResolvedValueOnce({ token: "design-token-2" });
    const getUserToken = vi
      .fn()
      .mockResolvedValueOnce("user-token-1")
      .mockResolvedValueOnce("user-token-2");
    const responseValue = {
      scenario: scenario(),
      trustedDesignId: "design-1",
      trustedPageId: "page-1",
    };
    const fetchImpl = successfulFetch(responseValue);

    const first = await loadTrustedReviewContext({
      endpoint: "https://backend.example/review-context",
      getDesignToken,
      getUserToken,
      fetchImpl,
    });
    const second = await loadTrustedReviewContext({
      endpoint: "https://backend.example/review-context",
      getDesignToken,
      getUserToken,
      fetchImpl,
    });

    expect(getDesignToken).toHaveBeenCalledTimes(2);
    expect(getUserToken).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://backend.example/review-context",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer user-token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ designToken: "design-token-1" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://backend.example/review-context",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-token-2" }),
        body: JSON.stringify({ designToken: "design-token-2" }),
      }),
    );
    expect(first.trustedDesignId).toBe("design-1");
    expect(first.trustedPageId).toBe("page-1");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.scenario)).toBe(true);
    expect(Object.isFrozen(first.scenario.source)).toBe(true);
    expect(second.scenario.scenarioId).toBe("scenario-review-1");
  });

  it("defensively captures backend context before returning it", async () => {
    const backendScenario = scenario();
    const responseValue = {
      scenario: backendScenario,
      trustedDesignId: "design-1",
      trustedPageId: "page-1",
    };
    const context = await loadTrustedReviewContext({
      endpoint: "https://backend.example/review-context",
      getDesignToken: async () => ({ token: "design-token" }),
      getUserToken: async () => "user-token",
      fetchImpl: successfulFetch(responseValue),
    });

    backendScenario.source.designId = "mutated-after-response";
    expect(context.scenario.source.designId).toBe("design-1");
    expect(context.trustedDesignId).toBe("design-1");
  });

  it("rejects design and page identity substitution from the backend response", async () => {
    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch({
          scenario: scenario(),
          trustedDesignId: "design-2",
          trustedPageId: "page-1",
        }),
      }),
    ).rejects.toThrow(/design identity/);

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch({
          scenario: scenario(),
          trustedDesignId: "design-1",
          trustedPageId: "page-2",
        }),
      }),
    ).rejects.toThrow(/page scope/);
  });

  it("rejects authority widening or auto-apply in returned scenarios", async () => {
    const unsafeScenario = scenario({
      presentation: {
        advisoryOnly: true,
        autoApply: true,
        target: "web-dashboard",
      } as unknown as HoloForgeScenario["presentation"],
    });

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch({
          scenario: unsafeScenario,
          trustedDesignId: "design-1",
        }),
      }),
    ).rejects.toThrow(/explicit-apply/);
  });

  it("rejects deceptive response descriptors without evaluating getters", async () => {
    let getterReads = 0;
    const deceptive = {
      trustedDesignId: "design-1",
      trustedPageId: "page-1",
    } as Record<string, unknown>;
    Object.defineProperty(deceptive, "scenario", {
      enumerable: true,
      get() {
        getterReads += 1;
        return scenario();
      },
    });

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch(deceptive),
      }),
    ).rejects.toThrow(/must not use accessors/);
    expect(getterReads).toBe(0);
  });

  it("fails closed when the trusted backend request is rejected", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as FetchImpl;

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl,
      }),
    ).rejects.toThrow(/status 401/);
  });
});
