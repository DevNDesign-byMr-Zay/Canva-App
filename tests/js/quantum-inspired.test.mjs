import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeBinary, scoreBinary } from '../../runtime/optimization/quantum-inspired.js';

test('scores binary assignments', () => {
  assert.equal(scoreBinary([-2, 3], [1, 0]), -2);
});

test('finds the exact minimum for an independent objective', () => {
  const result = optimizeBinary({ linear: [-4, 2, -1], seed: 9 });
  assert.deepEqual(result.bits, [1, 0, 1]);
  assert.equal(result.objective, -5);
  assert.equal(result.backend, 'canva-runtime-qis-reference-v1');
});

test('is reproducible for the same seed', () => {
  assert.deepEqual(
    optimizeBinary({ linear: [-1, 2], seed: 17 }),
    optimizeBinary({ linear: [-1, 2], seed: 17 }),
  );
});
