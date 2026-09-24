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

  it("snapshots and recursively freezes nested scenario decision state", async () => {
    const backendScenario = scenario();
    backendScenario.constraints.hard = [{ type: "bounds", limits: { minX: 0, maxX: 100 } }];
    backendScenario.candidate.layout.elements["element-1"] = {
      x: 10,
      y: 20,
      rotation: 0,
    };
    backendScenario.candidate.changedElementIds = ["element-1"];
    backendScenario.candidate.delta = {
      moved: { elementId: "element-1", from: { x: 0 }, to: { x: 10 } },
    };

    const context = await loadTrustedReviewContext({
      endpoint: "https://backend.example/review-context",
      getDesignToken: async () => ({ token: "design-token" }),
      getUserToken: async () => "user-token",
      fetchImpl: successfulFetch({
        scenario: backendScenario,
        trustedDesignId: "design-1",
        trustedPageId: "page-1",
      }),
    });

    (backendScenario.constraints.hard[0] as { limits: { maxX: number } }).limits.maxX = 999;
    backendScenario.candidate.layout.elements["element-1"].x = 999;
    (backendScenario.candidate.delta.moved as { to: { x: number } }).to.x = 999;

    expect((context.scenario.constraints.hard[0] as { limits: { maxX: number } }).limits.maxX).toBe(
      100,
    );
    expect(context.scenario.candidate.layout.elements["element-1"].x).toBe(10);
    expect((context.scenario.candidate.delta.moved as { to: { x: number } }).to.x).toBe(10);
    expect(Object.isFrozen(context.scenario.constraints)).toBe(true);
    expect(Object.isFrozen(context.scenario.constraints.hard)).toBe(true);
    expect(Object.isFrozen(context.scenario.constraints.hard[0])).toBe(true);
    expect(Object.isFrozen(context.scenario.candidate)).toBe(true);
    expect(Object.isFrozen(context.scenario.candidate.layout)).toBe(true);
    expect(Object.isFrozen(context.scenario.candidate.layout.elements["element-1"])).toBe(true);
    expect(Object.isFrozen(context.scenario.candidate.delta)).toBe(true);
  });

  it("fails closed on non-finite nested candidate geometry", async () => {
    const unsafeScenario = scenario();
    unsafeScenario.candidate.layout.elements["element-1"] = {
      x: Number.NaN,
      y: 20,
    };
    unsafeScenario.candidate.changedElementIds = ["element-1"];

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch({
          scenario: unsafeScenario,
          trustedDesignId: "design-1",
          trustedPageId: "page-1",
        }),
      }),
    ).rejects.toThrow(/numbers must be finite/);
  });

  it("rejects nested geometry accessors without executing them", async () => {
    const unsafeScenario = scenario();
    let reads = 0;
    const transform: Record<string, unknown> = { y: 20 };
    Object.defineProperty(transform, "x", {
      enumerable: true,
      get() {
        reads += 1;
        return 10;
      },
    });
    unsafeScenario.candidate.layout.elements["element-1"] = transform;
    unsafeScenario.candidate.changedElementIds = ["element-1"];

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch({
          scenario: unsafeScenario,
          trustedDesignId: "design-1",
          trustedPageId: "page-1",
        }),
      }),
    ).rejects.toThrow(/must not use accessors/);
    expect(reads).toBe(0);
  });

  it("does not let prototype-named backend fields disappear during capture", async () => {
    const responseValue = {
      scenario: scenario(),
      trustedDesignId: "design-1",
      trustedPageId: "page-1",
    } as Record<string, unknown>;
    Object.defineProperty(responseValue, "__proto__", {
      value: { hiddenAuthority: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    await expect(
      loadTrustedReviewContext({
        endpoint: "https://backend.example/review-context",
        getDesignToken: async () => ({ token: "design-token" }),
        getUserToken: async () => "user-token",
        fetchImpl: successfulFetch(responseValue),
      }),
    ).rejects.toThrow(/unsupported field: __proto__/);
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
