import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHoloForgeScenario,
  validateHoloForgeScenario,
} from '../../src/holoforge-canva-contract.mjs';

const base = {
  scenarioId: 'scenario-001',
  sourceDesignRef: 'canva-design-001',
  intent: 'improve presentation flow',
  constraints: [{ type: 'preserve-brand', value: true }],
  candidateLayout: { elements: [{ id: 'title', x: 120, y: 80 }] },
  backend: 'vaelon-deterministic-qi-v1',
  seed: 42,
  objectiveScore: 0.91,
  delta: 0.12,
  durationMs: 184,
};

test('creates and validates a deterministic scenario record', () => {
  const scenario = createHoloForgeScenario(base);
  assert.equal(scenario.schemaVersion, 1);
  assert.equal(scenario.status, 'candidate');
  assert.equal(validateHoloForgeScenario(scenario), true);
});

test('requires an array of constraint objects', () => {
  assert.throws(() => createHoloForgeScenario({ ...base, constraints: {} }), /constraints must be an array/);
  assert.throws(() => createHoloForgeScenario({ ...base, constraints: ['preserve-brand'] }), /constraints\[0\] must be an object/);
});

test('rejects invalid metrics and status values', () => {
  assert.throws(() => createHoloForgeScenario({ ...base, objectiveScore: Number.NaN }), /objectiveScore must be finite/);
  assert.throws(() => createHoloForgeScenario({ ...base, delta: Infinity }), /delta must be finite/);
  assert.throws(() => createHoloForgeScenario({ ...base, durationMs: -1 }), /durationMs must be a non-negative finite number/);
  assert.throws(() => createHoloForgeScenario({ ...base, status: 'approved' }), /unsupported scenario status/);
});

test('does not validate tampered scenario identity or source reference', () => {
  const scenario = createHoloForgeScenario(base);
  assert.equal(validateHoloForgeScenario({ ...scenario, scenarioId: '' }), false);
  assert.equal(validateHoloForgeScenario({ ...scenario, sourceDesignRef: '' }), false);
  assert.equal(validateHoloForgeScenario({ ...scenario, schemaVersion: 2 }), false);
});
