import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canApplyPrototypeScenario,
  findPrototypeScenario,
  getPrototypeApplyState,
  validatePrototypeScenario,
} from '../../prototype/holoforge/scenario-gate.js';

const sourceFingerprint = 'a'.repeat(64);
const validScenario = Object.freeze({
  id: 'hierarchy-first',
  title: 'Hierarchy Focus',
  interpretation: 'Increase headline dominance.',
  score: 0.92,
  baseline: 0.95,
  gap: 0.03,
  durationMs: 12,
  objective: 'hierarchy-balance-v1',
  seed: 'hierarchy-seed-001',
  backend: 'vaelon',
  algorithm: 'deterministic-candidate-v1',
  baselineBackend: 'classical-reference',
  baselineAlgorithm: 'exact-reference-v1',
  status: 'complete',
  hardConstraintsPassed: true,
  changedElementIds: ['headline-1'],
  sourceSnapshotFingerprint: sourceFingerprint,
  optimizationFingerprint: 'b'.repeat(64),
  scenarioFingerprint: 'c'.repeat(64),
  target: 'web-dashboard',
});

test('prototype evidence validator accepts a complete canonical projection', () => {
  assert.equal(validatePrototypeScenario(validScenario), true);
});

test('prototype evidence validator rejects incomplete or malformed identity', () => {
  assert.equal(validatePrototypeScenario({ ...validScenario, optimizationFingerprint: 'not-a-fingerprint' }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, sourceSnapshotFingerprint: 'a'.repeat(63) }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, durationMs: -1 }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, score: Number.NaN }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, backend: '' }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, objective: '   ' }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, changedElementIds: [''] }), false);
  assert.equal(validatePrototypeScenario({ ...validScenario, target: '' }), false);
});

test('prototype gate permits only an explicitly selected, current scenario', () => {
  assert.equal(findPrototypeScenario([validScenario], validScenario.id), validScenario);
  assert.equal(canApplyPrototypeScenario(validScenario, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), true);
});

test('prototype gate rejects stale, unselected, incomplete, or failed scenarios', () => {
  assert.equal(canApplyPrototypeScenario(validScenario, {
    selectedScenarioId: 'other',
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario(validScenario, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: 'b'.repeat(64),
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario({ ...validScenario, status: 'running' }, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario({ ...validScenario, hardConstraintsPassed: false }, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), false);
  assert.equal(canApplyPrototypeScenario(validScenario, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
  }), false);
});

test('prototype gate exposes a stable UI decision state', () => {
  assert.deepEqual(getPrototypeApplyState(validScenario, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), { canApply: true, blockReason: null });
  assert.deepEqual(getPrototypeApplyState({ ...validScenario, scenarioFingerprint: 'invalid' }, {
    selectedScenarioId: validScenario.id,
    currentSnapshotFingerprint: sourceFingerprint,
    explicitApply: true,
  }), { canApply: false, blockReason: 'invalid-evidence' });
});
