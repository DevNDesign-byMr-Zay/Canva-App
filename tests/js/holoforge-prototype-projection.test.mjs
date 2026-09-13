import assert from 'node:assert/strict';
import test from 'node:test';

import { holoforgeScenarioFixtures } from '../../src/holoforge-fixtures.mjs';
import { prototypeScenarios } from '../../prototype/holoforge/scenarios.js';

const projectionById = new Map(prototypeScenarios.map((scenario) => [scenario.id, scenario]));

test('Scenario Lab projection mirrors canonical fixture evidence', () => {
  assert.equal(prototypeScenarios.length, holoforgeScenarioFixtures.length);

  for (const fixture of holoforgeScenarioFixtures) {
    const projection = projectionById.get(fixture.scenarioId);
    assert.ok(projection, `missing projection for ${fixture.scenarioId}`);
    assert.equal(projection.objective, fixture.intent.objectiveId);
    assert.equal(projection.score, fixture.evidence.objectiveScore);
    assert.equal(projection.baseline, fixture.evidence.baseline.objectiveScore);
    assert.equal(projection.gap, fixture.evidence.objectiveGap);
    assert.equal(projection.durationMs, fixture.evidence.durationMs);
    assert.equal(projection.seed, fixture.evidence.seed);
    assert.equal(projection.backend, fixture.evidence.backend);
    assert.equal(projection.algorithm, fixture.evidence.algorithm);
    assert.equal(projection.baselineBackend, fixture.evidence.baseline.backend);
    assert.equal(projection.baselineAlgorithm, fixture.evidence.baseline.algorithm);
    assert.equal(projection.status, fixture.evidence.status);
    assert.equal(projection.hardConstraintsPassed, fixture.evidence.hardConstraintsPassed);
    assert.equal(projection.sourceSnapshotId, fixture.source.snapshotId);
    assert.equal(projection.sourceSnapshotFingerprint, fixture.source.snapshotFingerprint);
    assert.equal(projection.target, fixture.presentation.target);
  }
});

test('Scenario Lab does not invent candidate evidence', () => {
  for (const projection of prototypeScenarios) {
    assert.equal(typeof projection.backend, 'string');
    assert.equal(typeof projection.algorithm, 'string');
    assert.equal(typeof projection.baselineBackend, 'string');
    assert.equal(typeof projection.baselineAlgorithm, 'string');
    assert.equal(projection.status, 'complete');
    assert.equal(projection.hardConstraintsPassed, true);
  }
});
