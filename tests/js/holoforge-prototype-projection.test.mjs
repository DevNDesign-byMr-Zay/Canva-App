import assert from 'node:assert/strict';
import test from 'node:test';

import { holoforgeScenarioFixtures } from '../../src/holoforge-fixtures.mjs';
import { prototypeScenarios } from '../../prototype/holoforge/scenarios.js';

const projectionById = new Map(prototypeScenarios.map((scenario) => [scenario.id, scenario]));

function comparableProjection(fixture) {
  return {
    id: fixture.scenarioId,
    title: fixture.interpretation.label,
    interpretation: fixture.interpretation.summary,
    score: fixture.evidence.objectiveScore,
    baseline: fixture.evidence.baseline.objectiveScore,
    gap: fixture.evidence.objectiveGap,
    durationMs: fixture.evidence.durationMs,
    objective: fixture.intent.objectiveId,
    seed: fixture.evidence.seed,
    backend: fixture.evidence.backend,
    algorithm: fixture.evidence.algorithm,
    baselineBackend: fixture.evidence.baseline.backend,
    baselineAlgorithm: fixture.evidence.baseline.algorithm,
    status: fixture.evidence.status,
    hardConstraintsPassed: fixture.evidence.hardConstraintsPassed,
    tradeoff: fixture.interpretation.tradeoffs[0] ?? '',
    changed: fixture.candidate.changedElementIds.length,
    changedElementIds: fixture.candidate.changedElementIds,
    layout: fixture.candidate.layout.elements,
    delta: fixture.candidate.delta,
    sourceSnapshotId: fixture.source.snapshotId,
    sourceSnapshotFingerprint: fixture.source.snapshotFingerprint,
    optimizationFingerprint: fixture.provenance.optimizationFingerprint,
    scenarioFingerprint: fixture.provenance.scenarioFingerprint,
    target: fixture.presentation.target,
  };
}

test('Scenario Lab projection mirrors the complete canonical fixture envelope', () => {
  assert.equal(prototypeScenarios.length, holoforgeScenarioFixtures.length);

  for (const fixture of holoforgeScenarioFixtures) {
    const projection = projectionById.get(fixture.scenarioId);
    assert.ok(projection, `missing projection for ${fixture.scenarioId}`);
    assert.deepEqual(projection, comparableProjection(fixture));
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
    assert.match(projection.sourceSnapshotFingerprint, /^[a-f0-9]{64}$/);
    assert.match(projection.optimizationFingerprint, /^[a-f0-9]{64}$/);
    assert.match(projection.scenarioFingerprint, /^[a-f0-9]{64}$/);
  }
});

test('Scenario Lab rejects projection drift in semantic, geometry, or provenance fields', () => {
  for (const fixture of holoforgeScenarioFixtures) {
    const expected = comparableProjection(fixture);
    const projection = projectionById.get(fixture.scenarioId);

    for (const field of [
      'title',
      'interpretation',
      'objective',
      'seed',
      'backend',
      'algorithm',
      'baselineBackend',
      'baselineAlgorithm',
      'status',
      'tradeoff',
      'sourceSnapshotId',
      'sourceSnapshotFingerprint',
      'optimizationFingerprint',
      'scenarioFingerprint',
      'target',
    ]) {
      assert.equal(projection[field], expected[field], `${fixture.scenarioId} drifted in ${field}`);
    }

    assert.deepEqual(projection.changedElementIds, expected.changedElementIds);
    assert.deepEqual(projection.layout, expected.layout);
    assert.deepEqual(projection.delta, expected.delta);
  }
});
