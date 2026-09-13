import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, validateScenario } from '../../packages/holoforge/scenario-contract.mjs';

test('creates an inspectable Scenario Contract v0', () => {
  const scenario = createScenario({
    scenarioId: 'scenario-balanced-001',
    sourceDesignRef: 'design:example/page:1',
    intent: 'reduce spatial collisions while preserving hierarchy',
    constraints: ['preserve-title-proximity', 'no-overlap'],
    layout: { depth: 2, placements: [{ id: 'title', x: 0.2, y: 0.2 }] },
    backend: 'holoforge-classical-reference-v0',
    algorithm: 'exact-binary-placement',
    seed: 7,
    objective: 3,
    deltaFromSource: -2,
    durationMs: 4,
    status: 'evaluated',
  });

  assert.equal(scenario.contract, 'holoforge.scenario');
  assert.equal(scenario.version, '0');
  assert.equal(scenario.evidence.seed, 7);
  assert.equal(validateScenario(scenario), true);
});

test('rejects incomplete or unsafe scenario evidence', () => {
  assert.equal(validateScenario({ contract: 'holoforge.scenario', version: '0' }), false);
  assert.throws(() => createScenario({
    scenarioId: 'bad',
    sourceDesignRef: 'design:1',
    intent: 'test',
    layout: {},
    backend: 'reference',
    algorithm: 'exact',
    seed: -1,
    objective: 1,
    deltaFromSource: 0,
    durationMs: 1,
  }));
});
