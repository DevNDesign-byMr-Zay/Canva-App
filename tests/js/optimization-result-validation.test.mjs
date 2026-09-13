import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryProblem } from '../../runtime/optimization/contract.mjs';
import { normalizeBinaryOptimizationResult, validateBinaryOptimizationResult } from '../../runtime/optimization/result-validation.mjs';

test('accepts a result with one binary decision per variable', () => {
  const problem = createBinaryProblem({ linear: [-2, 1] });
  const result = { bits: [1, 0], objective: -2 };
  assert.equal(validateBinaryOptimizationResult(problem, result), result);
});

test('rejects malformed binary results', () => {
  const problem = createBinaryProblem({ linear: [-2, 1] });
  assert.throws(() => validateBinaryOptimizationResult(problem, { bits: [1], objective: -2 }), /match the problem/);
  assert.throws(() => validateBinaryOptimizationResult(problem, { bits: [1, 2], objective: -2 }), /must be binary/);
  assert.throws(() => validateBinaryOptimizationResult(problem, { bits: [1, 0], objective: Infinity }), /must be finite/);
});

test('returns defensive copies for normalized runtime results', () => {
  const problem = createBinaryProblem({ linear: [-2, 1] });
  const normalized = normalizeBinaryOptimizationResult(problem, { bits: [1, 0], objective: -2 });
  assert.deepEqual(normalized.problem, { kind: 'binary-linear', version: 1, linear: [-2, 1] });
  assert.deepEqual(normalized.result.bits, [1, 0]);
});
