import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHoloforgeStageModel } from '../../src/holoforge-stage-model.mjs';
import {
  hierarchyScenario,
  HOLOFORGE_SOURCE_FINGERPRINT,
} from '../../src/holoforge-fixtures.mjs';

test('Holo Stage is deterministic and read-only for the same scenario', () => {
  const first = buildHoloforgeStageModel({
    scenario: hierarchyScenario,
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });
  const second = buildHoloforgeStageModel({
    scenario: hierarchyScenario,
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });

  assert.equal(first.stageIdentity, second.stageIdentity);
  assert.equal(first.status, 'preview-ready');
  assert.equal(first.controls.mutation, false);
  assert.deepEqual(first.comparison.candidate.changedElementIds, ['headline-1', 'body-1']);
});

test('blocked scenario does not expose candidate comparison layers', () => {
  const model = buildHoloforgeStageModel({
    scenario: hierarchyScenario,
    currentSnapshotFingerprint: 'b'.repeat(64),
  });

  assert.equal(model.status, 'blocked');
  assert.equal(model.comparison, null);
  assert.equal(model.gates.previewEnabled, false);
});

test('explicit selected scenario becomes apply-ready without enabling mutation in stage controls', () => {
  const model = buildHoloforgeStageModel({
    scenario: hierarchyScenario,
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
    selectedScenarioId: hierarchyScenario.scenarioId,
    explicitApply: true,
  });

  assert.equal(model.status, 'apply-ready');
  assert.equal(model.gates.applyEnabled, true);
  assert.equal(model.controls.mutation, false);
});
