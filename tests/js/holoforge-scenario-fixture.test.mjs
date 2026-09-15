import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_SCENARIO } from '../../packages/holoforge/sample-scenario.mjs';
import { validateScenario } from '../../packages/holoforge/scenario-contract.mjs';

test('sample scenario is a valid portable candidate', () => {
  assert.equal(validateScenario(SAMPLE_SCENARIO), true);
  assert.equal(SAMPLE_SCENARIO.scenarioId, 'sample-balanced-001');
  assert.equal(SAMPLE_SCENARIO.status, 'evaluated');
});
