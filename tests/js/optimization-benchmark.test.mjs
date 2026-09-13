import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryProblem } from '../../runtime/optimization/contract.mjs';
import { compareBinaryOptimization } from '../../runtime/optimization/benchmark.mjs';

test('reports an exact match against the classical reference', () => {
  const problem = createBinaryProblem({ linear: [-3, 2, -1] });
  const reference = { bits: [1, 0, 1], objective: -4 };
  const candidate = { bits: [1, 0, 1], objective: -4 };
  assert.deepEqual(compareBinaryOptimization(problem, reference, candidate), {
    referenceObjective: -4,
    candidateObjective: -4,
    objectiveGap: 0,
    matchesReference: true,
  });
});

test('surfaces candidate objective gap', () => {
  const problem = createBinaryProblem({ linear: [-3, 2] });
  const result = compareBinaryOptimization(problem, { bits: [1, 0], objective: -3 }, { bits: [1, 1], objective: -1 });
  assert.equal(result.objectiveGap, 2);
  assert.equal(result.matchesReference, false);
});
