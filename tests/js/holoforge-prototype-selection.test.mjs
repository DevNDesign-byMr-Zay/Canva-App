import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canApplyPrototypeScenario,
  findPrototypeScenario,
  getPrototypeApplyState,
} from '../../prototype/holoforge/scenario-gate.js';

const sourceFingerprint = 'a'.repeat(64);
const scenario = Object.freeze({
  id: 'hierarchy-first',
  status: 'complete',
  hardConstraintsPassed: true,
  sourceSnapshotFingerprint: sourceFingerprint,
});

test('prototype gate permits only an explicitly selected, current scenario', () => {
  assert.equal(findPrototypeScenario([scenario], scenario.id), scenario);
  assert.equal(canApplyPrototypeScenario(scenario, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), true);
});

test('prototype gate rejects stale, unselected, incomplete, or failed scenarios', () => {
  assert.equal(canApplyPrototypeScenario(scenario, {
    selectedScenarioId: 'other',
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario(scenario, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: 'b'.repeat(64),
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario({ ...scenario, status: 'running' }, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario({ ...scenario, hardConstraintsPassed: false }, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario(scenario, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
  }), false);
});

test('prototype gate exposes a stable UI decision state', () => {
  assert.deepEqual(getPrototypeApplyState(scenario, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), { canApply: true, blockReason: null });
  assert.deepEqual(getPrototypeApplyState(scenario, {
    selectedScenarioId: scenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
  }), { canApply: false, blockReason: 'explicit-apply-required' });
});
