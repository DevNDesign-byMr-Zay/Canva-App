import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeBinary, scoreBinary } from '../../runtime/optimization/quantum-inspired.js';

test('returns stable optimization metadata for auditability', () => {
  const result = optimizeBinary({ linear: [1, -2], seed: 3 });
  assert.deepEqual(Object.keys(result).sort(), ['algorithm', 'backend', 'bits', 'objective', 'seed']);
});

test('rejects non-finite coefficients before producing an invalid objective', () => {
  for (const coefficient of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => optimizeBinary({ linear: [1, coefficient] }),
      /linear coefficients must be finite numbers/,
    );
    assert.throws(
      () => scoreBinary([coefficient], [1]),
      /linear coefficients must be finite numbers/,
    );
  }
});

test('rejects non-binary score inputs', () => {
  assert.throws(() => scoreBinary([1], [2]), /bits must contain only 0 or 1/);
});
