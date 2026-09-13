import test from 'node:test';
import assert from 'node:assert/strict';
import { createReceiptFromMeasurement } from '../../runtime/optimization/measurement-receipt.mjs';

const measurement = {
  schema: 'canva-runtime-optimization-measurement-v1',
  provider: 'reference-provider',
  problem: { kind: 'binary-linear', version: 1, variableCount: 2 },
  result: { backend: 'canva-runtime-qis-reference-v1', algorithm: 'exact-independent-binary-baseline', seed: 17, objective: -3, bits: [1, 1] },
  durationMs: 4,
};

test('bridges a validated measurement into the maintained receipt shape', () => {
  assert.deepEqual(createReceiptFromMeasurement(measurement, { startedAt: '2026-09-13T05:30:00.000Z' }), {
    schema: 'canva-runtime-optimization-receipt-v1',
    problem: { kind: 'binary-linear', version: 1, variableCount: 2 },
    solver: { backend: 'canva-runtime-qis-reference-v1', algorithm: 'exact-independent-binary-baseline', seed: 17 },
    objective: -3,
    bits: [1, 1],
    startedAt: '2026-09-13T05:30:00.000Z',
    durationMs: 4,
  });
});

test('rejects malformed measurements before receipt creation', () => {
  assert.throws(() => createReceiptFromMeasurement({ ...measurement, durationMs: -1 }), /duration must be non-negative/);
});
