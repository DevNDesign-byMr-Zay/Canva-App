import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryProblem } from '../../runtime/optimization/contract.mjs';
import { createOptimizationReceipt } from '../../runtime/optimization/provenance.mjs';

test('creates a stable, compact optimization receipt', () => {
  const problem = createBinaryProblem({ linear: [-2, 1, -3] });
  const receipt = createOptimizationReceipt({
    problem,
    result: { backend: 'canva-runtime-qis-reference-v1', algorithm: 'exact-independent-binary-baseline', seed: 9, bits: [1, 0, 1], objective: -5 },
    startedAt: '2026-09-13T04:00:00.000Z',
    durationMs: 2.5,
  });
  assert.deepEqual(receipt, {
    schema: 'canva-runtime-optimization-receipt-v1',
    problem: { kind: 'binary-linear', version: 1, variableCount: 3 },
    solver: { backend: 'canva-runtime-qis-reference-v1', algorithm: 'exact-independent-binary-baseline', seed: 9 },
    objective: -5,
    bits: [1, 0, 1],
    startedAt: '2026-09-13T04:00:00.000Z',
    durationMs: 2.5,
  });
});

test('rejects receipts without an objective', () => {
  const problem = createBinaryProblem({ linear: [1] });
  assert.throws(() => createOptimizationReceipt({ problem, result: {} }), /objective is required/);
});
