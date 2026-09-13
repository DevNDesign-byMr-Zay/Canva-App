import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryProblem } from '../../runtime/optimization/contract.mjs';
import { createReferenceProvider } from '../../runtime/optimization/reference-provider.mjs';
import { createValidatedProvider } from '../../runtime/optimization/validated-provider.mjs';
import { measureOptimization } from '../../runtime/optimization/measurement.mjs';

test('measures validated optimization with explicit timing', () => {
  const problem = createBinaryProblem({ linear: [-3, 2, -1] });
  const provider = createValidatedProvider(createReferenceProvider({ seed: 9 }));
  let clock = 100;
  const receipt = measureOptimization(provider, problem, {
    now: () => (clock += 5),
  });

  assert.equal(receipt.schema, 'canva-runtime-optimization-measurement-v1');
  assert.equal(receipt.provider, 'canva-runtime-qis-reference-v1');
  assert.equal(receipt.result.objective, -4);
  assert.equal(receipt.result.seed, 9);
  assert.deepEqual(receipt.result.bits, [1, 0, 1]);
  assert.equal(receipt.durationMs, 5);
});
