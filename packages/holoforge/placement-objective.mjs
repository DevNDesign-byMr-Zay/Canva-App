/**
 * HOLOFORGE placement objective v0.
 * Turns a spatial graph into a small, deterministic binary objective.
 *
 * A bit selects whether an element receives a proposed depth offset. The objective
 * penalizes projected overlap, depth displacement, and unnecessary movement while
 * rewarding separation of currently-overlapping pairs. It is intentionally small
 * enough to admit an exact reference implementation.
 */

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegativeFinite(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
  return value;
}

function weight(value, name, fallback) {
  if (value === undefined) return fallback;
  return nonNegativeFinite(value, name);
}

export function buildPlacementQubo(graph, {
  depthOffset = 1,
  overlapWeight = 10,
  depthWeight = 1,
  movementWeight = 0.1,
} = {}) {
  if (!graph || typeof graph !== 'object' || !Array.isArray(graph.nodes) || !Array.isArray(graph.relationships)) {
    throw new TypeError('graph must be a spatial graph');
  }
  const offset = nonNegativeFinite(depthOffset, 'depthOffset');
  const overlap = weight(overlapWeight, 'overlapWeight', 10);
  const depth = weight(depthWeight, 'depthWeight', 1);
  const movement = weight(movementWeight, 'movementWeight', 0.1);

  const index = new Map(graph.nodes.map((node, i) => [node.id, i]));
  const linear = graph.nodes.map((node) => depth * Math.abs(node.z) + movement * offset);
  const quadratic = [];

  for (const relationship of graph.relationships) {
    const source = index.get(relationship.source);
    const target = index.get(relationship.target);
    if (source === undefined || target === undefined) throw new TypeError('relationship references unknown node');
    if (relationship.overlapArea > 0 && offset > 0) {
      const penalty = overlap * relationship.overlapArea;
      quadratic.push({ i: source, j: target, coefficient: penalty });
    }
  }

  return Object.freeze({
    kind: 'qubo',
    version: 1,
    variableCount: graph.nodes.length,
    linear: Object.freeze(linear),
    quadratic: Object.freeze(quadratic.map((term) => Object.freeze(term))),
    objective: Object.freeze({
      name: 'spatial-separation-v0',
      direction: 'minimize',
      weights: Object.freeze({ overlap, depth, movement }),
      depthOffset: offset,
    }),
  });
}
