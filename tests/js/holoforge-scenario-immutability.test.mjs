import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScenarioEnvelope,
  validateScenarioEnvelope,
} from '../../src/holoforge-scenario-contract.mjs';
import { hierarchyScenario } from '../../src/holoforge-fixtures.mjs';

test('deep-freezes built HoloForge scenario envelopes', () => {
  const scenario = buildScenarioEnvelope({
    ...structuredClone(hierarchyScenario),
    provenance: {},
  });
  const fingerprint = scenario.provenance.scenarioFingerprint;

  assert.equal(Object.isFrozen(scenario), true);
  assert.equal(Object.isFrozen(scenario.source), true);
  assert.equal(Object.isFrozen(scenario.source.pageIds), true);
  assert.equal(Object.isFrozen(scenario.constraints), true);
  assert.equal(Object.isFrozen(scenario.constraints.hard), true);
  assert.equal(Object.isFrozen(scenario.evidence), true);
  assert.equal(Object.isFrozen(scenario.evidence.baseline), true);
  assert.equal(Object.isFrozen(scenario.provenance), true);

  assert.throws(() => {
    scenario.evidence.objectiveScore = 999;
  }, TypeError);
  assert.throws(() => {
    scenario.constraints.hard.push({ id: 'late-mutation' });
  }, TypeError);
  assert.throws(() => {
    scenario.source.pageIds[0] = 'changed-page';
  }, TypeError);

  assert.equal(scenario.provenance.scenarioFingerprint, fingerprint);
  assert.equal(validateScenarioEnvelope(scenario), true);
});
