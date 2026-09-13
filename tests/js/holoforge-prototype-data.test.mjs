import test from 'node:test';
import assert from 'node:assert/strict';

import { holoforgeScenarioFixtures } from '../../src/holoforge-fixtures.mjs';
import { validateScenarioEnvelope } from '../../src/holoforge-scenario-contract.mjs';
import { prototypeScenarios } from '../../prototype/holoforge/scenarios.js';

function projectScenario(scenario) {
  return {
    id: scenario.scenarioId,
    title: scenario.interpretation.label,
    interpretation: scenario.interpretation.summary,
    score: scenario.evidence.objectiveScore,
    baseline: scenario.evidence.baseline.objectiveScore,
    gap: scenario.evidence.objectiveGap,
    durationMs: scenario.evidence.durationMs,
    objective: scenario.intent.objectiveId,
    seed: scenario.evidence.seed,
    backend: scenario.evidence.backend,
    algorithm: scenario.evidence.algorithm,
    baselineBackend: scenario.evidence.baseline.backend,
    baselineAlgorithm: scenario.evidence.baseline.algorithm,
    status: scenario.evidence.status,
    hardConstraintsPassed: scenario.evidence.hardConstraintsPassed,
    tradeoff: scenario.interpretation.tradeoffs[0] ?? '',
    changed: scenario.candidate.changedElementIds.length,
    changedElementIds: scenario.candidate.changedElementIds,
    layout: scenario.candidate.layout.elements,
    delta: scenario.candidate.delta,
    sourceSnapshotId: scenario.source.snapshotId,
    sourceSnapshotFingerprint: scenario.source.snapshotFingerprint,
    optimizationFingerprint: scenario.provenance.optimizationFingerprint,
    scenarioFingerprint: scenario.provenance.scenarioFingerprint,
    target: scenario.presentation.target,
  };
}

test('browser prototype projection matches validated HoloForge fixtures exactly', () => {
  for (const fixture of holoforgeScenarioFixtures) {
    assert.equal(validateScenarioEnvelope(fixture), true);
  }

  assert.deepEqual(
    prototypeScenarios.map((scenario) => ({ ...scenario })),
    holoforgeScenarioFixtures.map(projectScenario),
  );
});

test('prototype projection exposes problem and result identity separately', () => {
  for (const scenario of prototypeScenarios) {
    assert.match(scenario.optimizationFingerprint, /^[a-f0-9]{64}$/);
    assert.match(scenario.scenarioFingerprint, /^[a-f0-9]{64}$/);
    assert.notEqual(scenario.optimizationFingerprint, scenario.scenarioFingerprint);
  }
});

test('projected layout and delta stay inside the presentation boundary', () => {
  for (const scenario of prototypeScenarios) {
    assert.ok(scenario.changedElementIds.length > 0);
    assert.equal(typeof scenario.layout, 'object');
    assert.equal(typeof scenario.delta, 'object');
    for (const id of scenario.changedElementIds) {
      assert.ok(Object.hasOwn(scenario.layout, id));
      assert.ok(Object.hasOwn(scenario.delta, id));
    }
  }
});

test('prototype projection remains presentation-only', () => {
  for (const scenario of prototypeScenarios) {
    assert.equal(scenario.target, 'web-dashboard');
    assert.equal(Object.hasOwn(scenario, 'apply'), false);
    assert.equal(Object.hasOwn(scenario, 'solver'), false);
  }
});
