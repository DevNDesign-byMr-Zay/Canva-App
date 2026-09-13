import test from 'node:test';
import assert from 'node:assert/strict';
import { forkScenarios } from '../../packages/holoforge/branch-model.mjs';

test('forks multiple candidate futures without mutating the source', () => {
  const scenarios = forkScenarios({
    sourceDesignRef: 'design:1/page:1',
    intent: 'improve spatial balance',
    constraints: ['no-overlap'],
    candidates: [
      { layout: { placements: [] }, backend: 'classical', algorithm: 'exact', seed: 1, objective: 2, deltaFromSource: -1, durationMs: 1, status: 'evaluated' },
      { layout: { placements: [] }, backend: 'qis-reference', algorithm: 'annealing', seed: 2, objective: 3, deltaFromSource: 0, durationMs: 2, status: 'evaluated' },
    ],
  });

  assert.equal(scenarios.length, 2);
  assert.equal(scenarios[0].scenarioId, 'scenario-1');
  assert.equal(scenarios[1].scenarioId, 'scenario-2');
  assert.equal(scenarios[0].sourceDesignRef, 'design:1/page:1');
  assert.equal(scenarios[1].evidence.backend, 'qis-reference');
});
