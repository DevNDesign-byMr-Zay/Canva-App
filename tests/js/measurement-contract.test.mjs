import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptimizationMeasurement } from '../../runtime/optimization/measurement-contract.mjs';

test('accepts an integer solver seed as measurement evidence', () => {
  const measurement = {
    schema: 'canva-runtime-optimization-measurement-v1',
    provider: 'reference-provider',
    problem: { kind: 'binary-linear', version: 1, variableCount: 2 },
    result: { objective: -3, seed: 17 },
    durationMs: 2,
  };
  assert.equal(validateOptimizationMeasurement(measurement), measurement);
});

test('rejects a non-integer solver seed', () => {
  assert.throws(() => validateOptimizationMeasurement({
    schema: 'canva-runtime-optimization-measurement-v1',
    provider: 'reference-provider',
    problem: { kind: 'binary-linear', version: 1, variableCount: 2 },
    result: { objective: -3, seed: 1.5 },
    durationMs: 2,
  }), /seed must be an integer/);
});
