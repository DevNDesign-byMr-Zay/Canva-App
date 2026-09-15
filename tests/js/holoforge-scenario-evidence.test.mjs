import test from 'node:test';
import assert from 'node:assert/strict';
import { attachScenarioEvidence } from '../../packages/holoforge/scenario-evidence.mjs';

test('attaches evidence without mutating the source scenario', () => {
  const scenario = {
    scenarioId: 'scenario-001',
    sourceDesignRef: 'design-001',
    objective: { name: 'spatial-separation-v0', direction: 'minimize' },
    status: 'candidate',
  };

  const evaluated = attachScenarioEvidence(scenario, {
    candidate: { backend: 'qis', algorithm: 'deterministic', objective: 10 },
    reference: { backend: 'exact', algorithm: 'exhaustive', objective: 9 },
    comparison: { objectiveGap: 1, relativeGap: 1 / 9 },
  });

  assert.equal(scenario.status, 'candidate');
  assert.equal(evaluated.status, 'evaluated');
  assert.equal(evaluated.evidence.metrics.objectiveGap, 1);
});
