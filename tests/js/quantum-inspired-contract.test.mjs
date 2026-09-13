import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeBinary } from '../../runtime/optimization/quantum-inspired.js';

test('returns stable optimization metadata for auditability', () => {
  const result = optimizeBinary({ linear: [1, -2], seed: 3 });
  assert.deepEqual(Object.keys(result).sort(), ['algorithm', 'backend', 'bits', 'objective', 'seed']);
});
