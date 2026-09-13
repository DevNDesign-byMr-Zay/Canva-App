import test from 'node:test';
import assert from 'node:assert/strict';
import { createOptimizationRegistry } from '../../runtime/optimization/registry.mjs';

test('registry lists and resolves providers deterministically', () => {
  const first = { solve: () => ({ objective: 1 }) };
  const second = { solve: () => ({ objective: 2 }) };
  const registry = createOptimizationRegistry({ beta: second, alpha: first });
  assert.deepEqual(registry.list(), ['alpha', 'beta']);
  assert.equal(registry.get('alpha'), first);
});

test('registry validates registrations and unknown providers', () => {
  const registry = createOptimizationRegistry();
  assert.throws(() => registry.register('', {}), /provider name is required/);
  assert.throws(() => registry.register('x', {}), /expose solve/);
  assert.throws(() => registry.get('missing'), /unknown optimization provider/);
});
