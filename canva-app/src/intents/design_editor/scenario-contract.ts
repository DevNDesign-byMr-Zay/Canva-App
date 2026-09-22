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

export function canonical(
  value: unknown,
  path = "scenario evidence",
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== "object") {
    throw new TypeError(`${path} must contain JSON-compatible evidence`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  seen.add(value);

  let output: unknown;
  if (Array.isArray(value)) {
    const allowedKeys = new Set(["length"]);
    const items: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      allowedKeys.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) throw new TypeError(`${path} must not contain sparse arrays`);
      if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
        throw new TypeError(`${path}[${index}] must be enumerable data`);
      }
      items.push(canonical(descriptor.value, `${path}[${index}]`, seen));
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowedKeys.has(key))) {
      throw new TypeError(`${path} arrays must not contain extra properties`);
    }
    output = items;
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`${path} must use plain objects`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
        throw new TypeError(`${path}.${key} must be enumerable data`);
      }
      Object.defineProperty(copy, key, {
        value: canonical(descriptor.value, `${path}.${key}`, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    output = copy;
  }

  seen.delete(value);
  return output;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function snapshotScenarioForPresentation(
  scenario: HoloForgeScenario,
): Readonly<HoloForgeScenario> {
  return deepFreeze(canonical(scenario, "scenario") as HoloForgeScenario);
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalConstraintSet(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("constraint set must be an array");
  const captured = canonical(value, "constraint set") as unknown[];
  return captured.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export async function computeOptimizationFingerprint(scenario: HoloForgeScenario): Promise<string> {
  const captured = canonical(scenario, "scenario") as HoloForgeScenario;
  return sha256({
    sourceSnapshotFingerprint: captured.source.snapshotFingerprint,
    objective: {
      id: captured.intent.objectiveId,
      direction: captured.intent.objectiveDirection,
    },
    constraints: {
      hard: canonicalConstraintSet(captured.constraints.hard),
      soft: canonicalConstraintSet(captured.constraints.soft),
    },
  });
}

export async function computeScenarioFingerprint(scenario: HoloForgeScenario): Promise<string> {
  const captured = canonical(scenario, "scenario") as HoloForgeScenario;
  const provenance = Object.fromEntries(
    Object.entries(captured.provenance).filter(([key]) => key !== "scenarioFingerprint"),
  );
  return sha256({ ...captured, provenance });
}

export async function hasCanonicalProvenance(scenario: HoloForgeScenario): Promise<boolean> {
  try {
    const captured = canonical(scenario, "scenario") as HoloForgeScenario;
    if (!HEX_64.test(captured.provenance.scenarioFingerprint)) return false;
    if (!HEX_64.test(captured.provenance.optimizationFingerprint)) return false;
    const [optimizationFingerprint, scenarioFingerprint] = await Promise.all([
      computeOptimizationFingerprint(captured),
      computeScenarioFingerprint(captured),
    ]);
    return (
      optimizationFingerprint === captured.provenance.optimizationFingerprint &&
      scenarioFingerprint === captured.provenance.scenarioFingerprint
    );
  } catch {
    return false;
  }
}

export function hasUniqueChangedElementIds(scenario: HoloForgeScenario): boolean {
  const ids = scenario.candidate.changedElementIds;
  return new Set(ids).size === ids.length;
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
