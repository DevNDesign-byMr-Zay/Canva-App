import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHoloForgeScenario,
  validateHoloForgeScenario,
} from '../../src/holoforge-canva-contract.mjs';

const base = {
  scenarioId: 'scenario-immutable-001',
  sourceDesignRef: 'canva-design-001',
  intent: 'preserve accepted scenario data',
  constraints: [{ type: 'preserve-brand', options: { locked: true } }],
  candidateLayout: { elements: [{ id: 'title', x: 120, y: 80 }] },
  backend: 'vaelon-deterministic-qi-v1',
  seed: 42,
  objectiveScore: 0.91,
  delta: 0.12,
  durationMs: 184,
};

test('nested caller mutation cannot change a created scenario', () => {
  const input = structuredClone(base);
  const scenario = createHoloForgeScenario(input);
  input.constraints[0].options.locked = false;
  input.candidateLayout.elements[0].x = 999;
  assert.equal(scenario.constraints[0].options.locked, true);
  assert.equal(scenario.candidateLayout.elements[0].x, 120);
  assert.equal(Object.isFrozen(scenario.constraints[0].options), true);
  assert.equal(Object.isFrozen(scenario.candidateLayout.elements[0]), true);
});

test('requires a stable reproducibility seed', () => {
  assert.throws(() => createHoloForgeScenario({ ...base, seed: undefined }), /seed/);
  assert.throws(() => createHoloForgeScenario({ ...base, seed: Number.NaN }), /seed/);
  assert.throws(() => createHoloForgeScenario({ ...base, seed: '   ' }), /seed/);
  assert.equal(createHoloForgeScenario({ ...base, seed: ' run-001 ' }).seed, 'run-001');

  const scenario = createHoloForgeScenario(base);
  assert.equal(validateHoloForgeScenario({ ...scenario, seed: {} }), false);
});
