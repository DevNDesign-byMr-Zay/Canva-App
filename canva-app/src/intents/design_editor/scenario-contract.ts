export type CanonicalCandidateElement = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  locked?: boolean;
};

export type HoloForgeScenario = {
  contractVersion: 1;
  scenarioId: string;
  source: {
    designId: string;
    snapshotId: string;
    pageIds: string[];
    snapshotFingerprint: string;
  };
  intent: {
    summary: string;
    objectiveId: string;
    objectiveDirection: "maximize" | "minimize";
  };
  constraints: { hard: unknown[]; soft: unknown[] };
  candidate: {
    layout: { elements: Record<string, CanonicalCandidateElement> };
    changedElementIds: string[];
    delta: Record<string, unknown>;
  };
  evidence: {
    backend: string;
    algorithm: string;
    seed: string;
    status: string;
    objectiveScore: number;
    baseline: { backend: string; algorithm: string; objectiveScore: number };
    objectiveGap: number;
    durationMs: number;
    hardConstraintsPassed: boolean;
    warnings: string[];
  };
  interpretation: {
    producer: string;
    label: string;
    summary: string;
    tradeoffs: string[];
  };
  presentation: {
    advisoryOnly: true;
    autoApply: false;
    target: "web-dashboard";
  };
  provenance: {
    scenarioFingerprint: string;
    optimizationFingerprint: string;
  };
};

export const HEX_64 = /^[a-f0-9]{64}$/;

export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalConstraintSet(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((constraint) => canonical(constraint))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export async function computeOptimizationFingerprint(scenario: HoloForgeScenario): Promise<string> {
  return sha256({
    sourceSnapshotFingerprint: scenario.source.snapshotFingerprint,
    objective: {
      id: scenario.intent.objectiveId,
      direction: scenario.intent.objectiveDirection,
    },
    constraints: {
      hard: canonicalConstraintSet(scenario.constraints.hard),
      soft: canonicalConstraintSet(scenario.constraints.soft),
    },
  });
}

export async function computeScenarioFingerprint(scenario: HoloForgeScenario): Promise<string> {
  const unsigned = structuredClone(scenario);
  const provenance = Object.fromEntries(
    Object.entries(unsigned.provenance).filter(([key]) => key !== "scenarioFingerprint"),
  );
  return sha256({ ...unsigned, provenance });
}

export async function hasCanonicalProvenance(scenario: HoloForgeScenario): Promise<boolean> {
  if (!HEX_64.test(scenario.provenance.scenarioFingerprint)) return false;
  if (!HEX_64.test(scenario.provenance.optimizationFingerprint)) return false;
  const [optimizationFingerprint, scenarioFingerprint] = await Promise.all([
    computeOptimizationFingerprint(scenario),
    computeScenarioFingerprint(scenario),
  ]);
  return optimizationFingerprint === scenario.provenance.optimizationFingerprint
    && scenarioFingerprint === scenario.provenance.scenarioFingerprint;
}

export function isSafeTransform(value: CanonicalCandidateElement): boolean {
  return [value.x, value.y, value.width, value.height, value.rotation, value.scale]
    .every((number) => number === undefined || Number.isFinite(number))
    && (value.scale === undefined || value.scale > 0);
}

export function isCanvaWritableTransform(value: CanonicalCandidateElement): boolean {
  return isSafeTransform(value)
    && value.width === undefined
    && value.height === undefined
    && value.scale === undefined
    && value.locked === undefined;
}
