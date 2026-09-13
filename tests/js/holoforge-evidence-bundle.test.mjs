import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceBundle, validateEvidenceBundle } from '../../packages/holoforge/evidence-bundle.mjs';

test('creates portable comparative evidence', () => {
  const bundle = createEvidenceBundle({
    scenarioId: 'scenario-001',
    sourceDesignRef: 'design-001',
    objective: { name: 'spatial-separation-v0', direction: 'minimize' },
    candidate: { backend: 'reference-qis', algorithm: 'deterministic', objective: 12 },
    reference: { backend: 'exact', algorithm: 'exhaustive', objective: 10 },
    comparison: { objectiveGap: 2, relativeGap: 0.2 },
  });

  assert.equal(bundle.schema, 'holoforge.evidence-bundle');
  assert.equal(bundle.metrics.objectiveGap, 2);
  assert.equal(validateEvidenceBundle(bundle), true);
});

test('rejects malformed evidence bundles', () => {
  assert.equal(validateEvidenceBundle({ schema: 'wrong', version: '0' }), false);
  assert.throws(() => createEvidenceBundle({ scenarioId: '', sourceDesignRef: 'd', objective: {}, candidate: {} }), /scenarioId/);
});
