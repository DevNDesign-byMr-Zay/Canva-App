import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryProblem } from '../../runtime/optimization/contract.mjs';
import { createReferenceProvider } from '../../runtime/optimization/reference-provider.mjs';
import { createValidatedProvider } from '../../runtime/optimization/validated-provider.mjs';

test('validated provider preserves valid deterministic output', () => {
  const problem = createBinaryProblem({ linear: [-3, 2, -1] });
  const provider = createValidatedProvider(createReferenceProvider({ seed: 4 }));
  const result = provider.solve(problem);
  assert.deepEqual(result.bits, [1, 0, 1]);
  assert.equal(result.objective, -4);
  assert.equal(result.seed, 4);
});

test('validated provider rejects malformed output', () => {
  const problem = createBinaryProblem({ linear: [-1, 1] });
  const provider = createValidatedProvider({
    name: 'invalid',
    solve: () => ({ bits: [1, 2], objective: -1 }),
  });
  assert.throws(() => provider.solve(problem), /must be binary/);
});
