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
    tradeoff: scenario.interpretation.tradeoffs[0] ?? '',
    changed: scenario.candidate.changedElementIds.length,
    sourceSnapshotId: scenario.source.snapshotId,
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

test('prototype projection remains presentation-only', () => {
  for (const scenario of prototypeScenarios) {
    assert.equal(scenario.target, 'web-dashboard');
    assert.equal(Object.hasOwn(scenario, 'apply'), false);
    assert.equal(Object.hasOwn(scenario, 'solver'), false);
  }
});
