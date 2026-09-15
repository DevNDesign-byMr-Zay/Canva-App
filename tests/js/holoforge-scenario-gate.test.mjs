import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canApplyPrototypeScenario,
  findPrototypeScenario,
  getPrototypeApplyState,
  validatePrototypeScenario,
} from '../../prototype/holoforge/scenario-gate.js';
import { prototypeScenarios } from '../../prototype/holoforge/scenarios.js';

const scenario = prototypeScenarios[0];
const currentSnapshotFingerprint = scenario.sourceSnapshotFingerprint;

function context(overrides = {}) {
  return {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint,
    explicitApply: true,
    ...overrides,
  };
}

test('valid fixture passes the browser-safe evidence gate', () => {
  assert.equal(validatePrototypeScenario(scenario), true);
  assert.equal(canApplyPrototypeScenario(scenario, context()), true);
  assert.deepEqual(getPrototypeApplyState(scenario, context()), {
    canApply: true,
    blockReason: null,
  });
});

test('apply gate fails closed for incomplete evidence', () => {
  const partial = { ...scenario, status: 'partial' };
  assert.equal(canApplyPrototypeScenario(partial, context()), false);
  assert.equal(getPrototypeApplyState(partial, context()).blockReason, 'incomplete-evidence');
});

test('apply gate blocks failed hard constraints', () => {
  const failed = { ...scenario, hardConstraintsPassed: false };
  assert.equal(canApplyPrototypeScenario(failed, context()), false);
  assert.equal(getPrototypeApplyState(failed, context()).blockReason, 'hard-constraint-failure');
});

test('apply gate blocks stale source snapshots', () => {
  const stale = { ...scenario, sourceSnapshotFingerprint: 'b'.repeat(64) };
  assert.equal(validatePrototypeScenario(stale), true);
  assert.equal(canApplyPrototypeScenario(stale, context()), false);
  assert.equal(getPrototypeApplyState(stale, context()).blockReason, 'stale-source');
});

test('apply gate requires the selected scenario', () => {
  assert.equal(getPrototypeApplyState(scenario, context({ selectedScenarioId: 'other' })).blockReason, 'scenario-not-selected');
});

test('apply gate requires an explicit human action', () => {
  assert.equal(getPrototypeApplyState(scenario, context({ explicitApply: false })).blockReason, 'explicit-apply-required');
});

test('malformed evidence is rejected before any apply decision', () => {
  const malformed = { ...scenario, optimizationFingerprint: 'not-a-fingerprint' };
  assert.equal(validatePrototypeScenario(malformed), false);
  assert.equal(getPrototypeApplyState(malformed, context()).blockReason, 'invalid-evidence');
});

test('scenario lookup is deterministic and returns null for unknown ids', () => {
  assert.equal(findPrototypeScenario(prototypeScenarios, scenario.id), scenario);
  assert.equal(findPrototypeScenario(prototypeScenarios, 'missing-scenario'), null);
});
