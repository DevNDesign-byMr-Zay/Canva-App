import assert from 'node:assert/strict';
import test from 'node:test';

import { hierarchyScenario, HOLOFORGE_SOURCE_FINGERPRINT } from '../../src/holoforge-fixtures.mjs';
import { buildHoloforgeStageModel } from '../../src/holoforge-stage-model.mjs';

test('stage model keeps an immutable snapshot of scenario data', () => {
  const scenario = structuredClone(hierarchyScenario);
  const model = buildHoloforgeStageModel({
    scenario,
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });

  const identity = model.stageIdentity;
  const score = model.evidence.objectiveScore;
  const sourcePage = model.source.pageIds[0];

  scenario.evidence.objectiveScore += 1;
  scenario.source.pageIds[0] = 'other-page';

  assert.equal(model.stageIdentity, identity);
  assert.equal(model.evidence.objectiveScore, score);
  assert.equal(model.source.pageIds[0], sourcePage);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.evidence), true);
  assert.equal(Object.isFrozen(model.source.pageIds), true);
  assert.equal(Object.isFrozen(model.comparison), true);
  assert.equal(Object.isFrozen(model.comparison.candidate.layout), true);
  assert.equal(Object.isFrozen(model.comparison.candidate.changedElementIds), true);
  assert.equal(Object.isFrozen(model.controls), true);
  assert.equal(Object.isFrozen(model.gates), true);
});

test('equivalent validated scenario snapshots produce the same stage identity', () => {
  const first = buildHoloforgeStageModel({
    scenario: structuredClone(hierarchyScenario),
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });
  const second = buildHoloforgeStageModel({
    scenario: structuredClone(hierarchyScenario),
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });

  assert.equal(first.stageIdentity, second.stageIdentity);
  assert.deepEqual(first.comparison, second.comparison);
  assert.deepEqual(first.gates, second.gates);
});
