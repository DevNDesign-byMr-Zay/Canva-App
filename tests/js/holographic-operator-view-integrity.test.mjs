import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHolographicCanvaPayload, TARGETS } from '../../src/holographic-scene-adapter.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

const scene = {
  sceneVersion: 2,
  snapshotId: 'snapshot-integrity-001',
  sceneId: 'scene-integrity-001',
  provenanceRef: 'experiment-integrity-001',
  rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
  layers: {
    topology: { nodes: 3 },
    attention: [
      { priority: 20, severity: 'warning', reason: 'load approaching limit', evidenceRef: 'evidence-2', advisoryOnly: true },
      { priority: 10, severity: 'high', reason: 'renewable forecast deviation', evidenceRef: 'evidence-1', advisoryOnly: true },
    ],
    solverComparison: [{ candidate: 'classical-reference', objective: 1 }, { candidate: 'quantum-inspired', objective: 0.5 }],
  },
  metrics: { generationKw: 40, loadKw: 50, renewableShare: 0.8 },
};

test('operator view remains deterministic and carries solver comparison data', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'holo-mat' });
  const first = buildHolographicOperatorView({ payload });
  const second = buildHolographicOperatorView({ payload });
  assert.deepEqual(first, second);
  assert.deepEqual(first.attention.map((item) => item.evidenceRef), ['evidence-1', 'evidence-2']);
  assert.deepEqual(first.comparison.candidates, scene.layers.solverComparison);
  assert.equal(first.comparison.candidateCount, 2);
  assert.equal(first.presentation.authoritative, false);
  assert.equal(first.presentation.physicalActuation, false);
  assert.equal(validateHolographicOperatorView(first), true);
});

test('operator view carries the exact solver candidate count across multiple layers', () => {
  const multiLayerScene = {
    ...scene,
    layers: {
      ...scene.layers,
      solverComparison: undefined,
      solverComparisonClassical: undefined,
    },
  };
  multiLayerScene.layers = {
    topology: scene.layers.topology,
    attention: scene.layers.attention,
    solverComparison: [{ candidate: 'classical-reference', objective: 1 }],
    solverComparisonSecondary: [{ candidate: 'quantum-inspired', objective: 0.5 }],
  };
  const payload = buildHolographicCanvaPayload({ scene: multiLayerScene });
  const view = buildHolographicOperatorView({ payload });
  assert.equal(view.comparison.candidateCount, 1);
  assert.equal(view.comparison.candidates.length, 1);
  assert.equal(validateHolographicOperatorView(view), true);
});

test('operator view supports every renderer-neutral holographic target', () => {
  for (const target of TARGETS) {
    const payload = buildHolographicCanvaPayload({ scene, target });
    const view = buildHolographicOperatorView({ payload });
    assert.equal(view.target, target);
    assert.equal(validateHolographicOperatorView(view), true);
  }
});

test('operator view rejects tampering after construction', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'projector' });
  const view = buildHolographicOperatorView({ payload });
  assert.equal(validateHolographicOperatorView({ ...view, target: 'holo-mat' }), false);
  assert.equal(validateHolographicOperatorView({ ...view, comparison: { ...view.comparison, metrics: { generationKw: 999 } } }), false);
  assert.equal(validateHolographicOperatorView({ ...view, comparison: { ...view.comparison, candidateCount: 99 } }), false);
  assert.equal(validateHolographicOperatorView({ ...view, attention: [{ ...view.attention[0], reason: 'tampered' }, view.attention[1]] }), false);
  assert.equal(validateHolographicOperatorView({ ...view, presentation: { ...view.presentation, authoritative: true } }), false);
});

test('operator view rejects an invalid source fingerprint', () => {
  const payload = buildHolographicCanvaPayload({ scene });
  const view = buildHolographicOperatorView({ payload });
  assert.equal(validateHolographicOperatorView({ ...view, source: { ...view.source, payloadFingerprint: '0'.repeat(64) } }), false);
});
