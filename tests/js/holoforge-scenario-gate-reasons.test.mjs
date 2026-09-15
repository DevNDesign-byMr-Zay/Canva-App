import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrototypeApplyBlockReason } from '../../prototype/holoforge/scenario-gate-reasons.js';

const scenario = {
  id: 'scenario-a',
  status: 'complete',
  hardConstraintsPassed: true,
  sourceSnapshotFingerprint: 'a'.repeat(64),
};

const context = {
  selectedScenarioId: 'scenario-a',
  currentSnapshotFingerprint: 'a'.repeat(64),
  explicitApply: true,
};

test('returns null when the prototype apply gate is satisfied', () => {
  assert.equal(getPrototypeApplyBlockReason(scenario, context), null);
});

test('reports the first deterministic blocking condition', () => {
  assert.equal(getPrototypeApplyBlockReason(null, context), 'missing-scenario');
  assert.equal(getPrototypeApplyBlockReason({ ...scenario, status: 'running' }, context), 'incomplete-evidence');
  assert.equal(getPrototypeApplyBlockReason({ ...scenario, hardConstraintsPassed: false }, context), 'hard-constraint-failure');
  assert.equal(getPrototypeApplyBlockReason(scenario, { ...context, currentSnapshotFingerprint: 'b'.repeat(64) }), 'stale-source');
  assert.equal(getPrototypeApplyBlockReason(scenario, { ...context, selectedScenarioId: 'scenario-b' }), 'scenario-not-selected');
  assert.equal(getPrototypeApplyBlockReason(scenario, { ...context, explicitApply: false }), 'explicit-apply-required');
});
