import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryProblem, runOptimization } from '../../runtime/optimization/contract.mjs';
import { createReferenceProvider } from '../../runtime/optimization/reference-provider.mjs';

test('runtime optimization contract is deterministic and explicit', () => {
  const problem = createBinaryProblem({ linear: [-3, 2, -1] });
  const result = runOptimization(createReferenceProvider({ seed: 4 }), problem);
  assert.equal(result.problemKind, 'binary-linear');
  assert.equal(result.problemVersion, 1);
  assert.deepEqual(result.bits, [1, 0, 1]);
  assert.equal(result.objective, -4);
  assert.equal(result.seed, 4);
});

test('runtime contract rejects malformed problems', () => {
  assert.throws(() => runOptimization(createReferenceProvider(), { kind: 'other', version: 1 }), /version 1 binary-linear/);
});
