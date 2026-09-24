import type { CanvaDesignSnapshot } from "./canva-design";

export type PlacementSlot = {
  slotId: string;
  x: number;
  y: number;
};

export type PlacementAssignment = {
  elementId: string;
  slotId: string;
  x: number;
  y: number;
};

export type PlacementEvidence = {
  backend: "classical-reference" | "vaelon";
  algorithm: "exact-enumeration-v1" | "deterministic-binary-local-search-v1";
  seed: string;
  objectiveScore: number;
  assignments: PlacementAssignment[];
  status: "complete";
  deterministic: true;
  advisoryOnly: true;
};

export type PlacementExperimentResult = {
  version: 1;
  sourceFingerprint: string;
  objective: "minimize-normalized-placement-distance";
  classical: PlacementEvidence;
  candidate: PlacementEvidence;
  objectiveGap: number;
  comparison: "observational-only";
  safety: {
    autoApply: false;
    authoritative: false;
  };
};

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function text(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [
      item,
      ...tail,
    ]),
  );
}

function assignmentScore(
  elements: ReadonlyArray<{ id: string; left: number; top: number }>,
  slots: readonly PlacementSlot[],
  slotOrder: readonly number[],
  width: number,
  height: number,
): number {
  const diagonal = Math.hypot(width, height) || 1;
  const total = elements.reduce((sum, element, index) => {
    const slot = slots[slotOrder[index]];
    return sum + Math.hypot(slot.x - element.left, slot.y - element.top) / diagonal;
  }, 0);
  return Number(total.toFixed(9));
}

function assignmentsFromOrder(
  elements: ReadonlyArray<{ id: string }>,
  slots: readonly PlacementSlot[],
  order: readonly number[],
): PlacementAssignment[] {
  return elements.map((element, index) => ({
    elementId: element.id,
    slotId: slots[order[index]].slotId,
    x: slots[order[index]].x,
    y: slots[order[index]].y,
  }));
}

function lexicographicOrder(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function exactReference(
  elements: ReadonlyArray<{ id: string; left: number; top: number }>,
  slots: readonly PlacementSlot[],
  width: number,
  height: number,
): { score: number; order: number[] } {
  const slotIndexes = slots.map((_, index) => index);
  let best: { score: number; order: number[] } | null = null;
  for (const order of permutations(slotIndexes).filter((item) => item.length === elements.length)) {
    const score = assignmentScore(elements, slots, order, width, height);
    if (
      best === null ||
      score < best.score ||
      (score === best.score && lexicographicOrder(order, best.order) < 0)
    ) {
      best = { score, order };
    }
  }
  if (!best) throw new Error("exact reference could not produce an assignment");
  return best;
}

function deterministicBinaryCandidate(
  elements: ReadonlyArray<{ id: string; left: number; top: number }>,
  slots: readonly PlacementSlot[],
  width: number,
  height: number,
): { score: number; order: number[] } {
  const remaining = new Set(slots.map((_, index) => index));
  const order: number[] = [];

  for (const element of elements) {
    const ranked = [...remaining]
      .map((slotIndex) => ({
        slotIndex,
        score: assignmentScore([element], slots, [slotIndex], width, height),
      }))
      .sort((left, right) => left.score - right.score || left.slotIndex - right.slotIndex);
    const selected = ranked[0].slotIndex;
    remaining.delete(selected);
    order.push(selected);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let left = 0; left < order.length; left += 1) {
      for (let right = left + 1; right < order.length; right += 1) {
        const candidate = [...order];
        [candidate[left], candidate[right]] = [candidate[right], candidate[left]];
        const currentScore = assignmentScore(elements, slots, order, width, height);
        const candidateScore = assignmentScore(elements, slots, candidate, width, height);
        if (
          candidateScore < currentScore ||
          (candidateScore === currentScore && lexicographicOrder(candidate, order) < 0)
        ) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  return { score: assignmentScore(elements, slots, order, width, height), order };
}

export function runPlacementExperiment({
  snapshot,
  elementIds,
  slots,
  seed = "placement-seed-v1",
}: {
  snapshot: CanvaDesignSnapshot;
  elementIds: string[];
  slots: PlacementSlot[];
  seed?: string;
}): Readonly<PlacementExperimentResult> {
  if (!snapshot?.fingerprint) throw new TypeError("snapshot fingerprint is required");
  if (!Array.isArray(elementIds) || elementIds.length === 0 || elementIds.length > 6) {
    throw new TypeError("elementIds must contain between 1 and 6 elements");
  }
  if (new Set(elementIds).size !== elementIds.length) {
    throw new TypeError("elementIds must be unique");
  }
  if (!Array.isArray(slots) || slots.length !== elementIds.length) {
    throw new TypeError("slots must match the number of selected elements");
  }
  if (new Set(slots.map((slot) => slot.slotId)).size !== slots.length) {
    throw new TypeError("slot IDs must be unique");
  }

  const elements = elementIds.map((elementId) => {
    const element = snapshot.elements.find((entry) => entry.id === elementId);
    if (!element) throw new TypeError(`element not found in reviewed snapshot: ${elementId}`);
    if (element.locked) throw new TypeError(`locked element cannot enter placement experiment: ${elementId}`);
    return {
      id: element.id,
      left: finite(element.left, `${elementId}.left`),
      top: finite(element.top, `${elementId}.top`),
    };
  });
  const normalizedSlots = slots.map((slot, index) => ({
    slotId: text(slot.slotId, `slots[${index}].slotId`),
    x: finite(slot.x, `slots[${index}].x`),
    y: finite(slot.y, `slots[${index}].y`),
  }));
  const pageWidth = finite(snapshot.pageDimensions.width, "snapshot.pageDimensions.width");
  const pageHeight = finite(snapshot.pageDimensions.height, "snapshot.pageDimensions.height");
  const normalizedSeed = text(seed, "seed");

  const exact = exactReference(elements, normalizedSlots, pageWidth, pageHeight);
  const candidate = deterministicBinaryCandidate(
    elements,
    normalizedSlots,
    pageWidth,
    pageHeight,
  );

  return Object.freeze({
    version: 1,
    sourceFingerprint: snapshot.fingerprint,
    objective: "minimize-normalized-placement-distance",
    classical: Object.freeze({
      backend: "classical-reference",
      algorithm: "exact-enumeration-v1",
      seed: normalizedSeed,
      objectiveScore: exact.score,
      assignments: Object.freeze(assignmentsFromOrder(elements, normalizedSlots, exact.order)),
      status: "complete",
      deterministic: true,
      advisoryOnly: true,
    }),
    candidate: Object.freeze({
      backend: "vaelon",
      algorithm: "deterministic-binary-local-search-v1",
      seed: normalizedSeed,
      objectiveScore: candidate.score,
      assignments: Object.freeze(
        assignmentsFromOrder(elements, normalizedSlots, candidate.order),
      ),
      status: "complete",
      deterministic: true,
      advisoryOnly: true,
    }),
    objectiveGap: Number((candidate.score - exact.score).toFixed(9)),
    comparison: "observational-only",
    safety: Object.freeze({
      autoApply: false,
      authoritative: false,
    }),
  });
}
