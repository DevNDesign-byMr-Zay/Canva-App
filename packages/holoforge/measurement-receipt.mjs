/**
 * HOLOFORGE comparative measurement receipt v0.
 *
 * The receipt is intentionally provider-neutral: an exact reference establishes
 * the measurable floor, while the candidate solver is evaluated against the same
 * objective and evidence shape. No claim of quantum advantage is made here.
 */

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function integer(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export function evaluateQubo(linear, quadratic, bits) {
  if (!Array.isArray(linear) || !Array.isArray(quadratic) || !Array.isArray(bits) || linear.length !== bits.length) {
    throw new TypeError('linear, quadratic and bits must describe the same problem');
  }
  return linear.reduce((sum, coefficient, i) => sum + finite(coefficient, `linear[${i}]`) * bits[i], 0)
    + quadratic.reduce((sum, term) => sum + finite(term.coefficient, 'quadratic coefficient') * bits[term.i] * bits[term.j], 0);
}

export function solveExactly(qubo) {
  integer(qubo.variableCount, 'variableCount');
  if (qubo.variableCount > 20) throw new RangeError('exact reference is limited to 20 variables');
  let best = null;
  const count = 2 ** qubo.variableCount;
  for (let mask = 0; mask < count; mask += 1) {
    const bits = Array.from({ length: qubo.variableCount }, (_, i) => (mask >> i) & 1);
    const objective = evaluateQubo(qubo.linear, qubo.quadratic, bits);
    if (!best || objective < best.objective) best = { bits, objective };
  }
  return { backend: 'holoforge-exact-reference-v1', algorithm: 'exhaustive-binary-search', ...best };
}

function seededUnit(seed) {
  let state = seed >>> 0;
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 4294967296;
}

export function solveCandidate(qubo, { seed = 1, iterations = 512 } = {}) {
  integer(seed, 'seed');
  integer(iterations, 'iterations');
  const bits = Array(qubo.variableCount).fill(0);
  let best = evaluateQubo(qubo.linear, qubo.quadratic, bits);
  let state = seed >>> 0;
  for (let step = 0; step < iterations; step += 1) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const index = qubo.variableCount === 0 ? 0 : state % qubo.variableCount;
    if (qubo.variableCount === 0) break;
    bits[index] = bits[index] ? 0 : 1;
    const objective = evaluateQubo(qubo.linear, qubo.quadratic, bits);
    if (objective <= best) {
      best = objective;
    } else if (seededUnit(state) > 0.08) {
      bits[index] = bits[index] ? 0 : 1;
    }
  }
  return {
    backend: 'holoforge-qis-reference-v1',
    algorithm: 'deterministic-annealing-binary-search',
    seed,
    iterations,
    bits: [...bits],
    objective: evaluateQubo(qubo.linear, qubo.quadratic, bits),
  };
}

export function createMeasurementReceipt({ qubo, seed = 1, iterations = 512, durationMs = null } = {}) {
  const startedAt = Date.now();
  const reference = solveExactly(qubo);
  const candidate = solveCandidate(qubo, { seed, iterations });
  const candidateObjective = candidate.objective;
  const referenceObjective = reference.objective;
  const gap = candidateObjective - referenceObjective;
  const relativeGap = referenceObjective === 0 ? null : gap / Math.abs(referenceObjective);
  const elapsed = durationMs === null ? Date.now() - startedAt : finite(durationMs, 'durationMs');

  return Object.freeze({
    schema: 'holoforge-measurement-receipt-v0',
    problem: Object.freeze({ kind: qubo.kind, version: qubo.version, variableCount: qubo.variableCount }),
    configuration: Object.freeze({ seed, iterations }),
    reference: Object.freeze(reference),
    candidate: Object.freeze(candidate),
    comparison: Object.freeze({ objectiveGap: gap, relativeGap, candidateMatchesReference: gap === 0 }),
    durationMs: elapsed,
  });
}
