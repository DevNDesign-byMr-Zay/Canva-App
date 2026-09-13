import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptimizationMeasurement, MEASUREMENT_SCHEMA } from '../../runtime/optimization/measurement-contract.mjs';

test('accepts a valid measurement receipt', () => {
  const measurement = {
    schema: MEASUREMENT_SCHEMA,
    provider: 'canva-runtime-qis-reference-v1',
    problem: { kind: 'binary-linear', version: 1, variableCount: 2 },
    result: { objective: -2 },
    durationMs: 4,
  };
  assert.equal(validateOptimizationMeasurement(measurement), measurement);
});

test('rejects invalid measurement receipts', () => {
  assert.throws(() => validateOptimizationMeasurement(null), /version 1/);
  assert.throws(() => validateOptimizationMeasurement({ schema: MEASUREMENT_SCHEMA }), /provider/);
  assert.throws(() => validateOptimizationMeasurement({
    schema: MEASUREMENT_SCHEMA,
    provider: 'reference',
    problem: { kind: 'binary-linear', version: 1 },
    result: { objective: Infinity },
    durationMs: 1,
  }), /finite/);
});
