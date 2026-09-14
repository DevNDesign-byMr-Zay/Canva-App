import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHolographicCanvaPayload,
  validateHolographicCanvaPayload,
} from '../../src/holographic-scene-adapter.mjs';
import {
  buildHolographicOperatorView,
  validateHolographicOperatorView,
} from '../../src/holographic-operator-view.mjs';

function buildMutableScene() {
  return {
    sceneVersion: 2,
    snapshotId: 'snapshot-immutable-001',
    sceneId: 'scene-immutable-001',
    provenanceRef: 'experiment-immutable-001',
    rendererContract: {
      authoritativeSource: 'thergrid-decision-receipt',
    },
    layers: {
      topology: [{ id: 'node-1', position: { x: 1, y: 2, z: 3 } }],
      attention: [
        {
          priority: 1,
          severity: 'info',
          reason: 'review topology',
          evidenceRef: 'receipt-1',
          advisoryOnly: true,
        },
      ],
      solverComparison: [
        { candidate: 'classical-reference', score: 12 },
        { candidate: 'quantum-inspired', score: 10 },
      ],
    },
    proposal: { id: 'proposal-1', status: 'advisory' },
    metrics: { confidence: 0.82, nested: { horizon: 24 } },
  };
}

test('captures nested payload state before issuing the payload fingerprint', () => {
  const scene = buildMutableScene();
  const payload = buildHolographicCanvaPayload({ scene, target: 'web-dashboard' });
  const topology = payload.layers.find((layer) => layer.id === 'topology');
  const fingerprint = payload.payloadFingerprint;

  assert.equal(Object.isFrozen(payload.layers), true);
  assert.equal(Object.isFrozen(topology), true);
  assert.equal(Object.isFrozen(topology.data), true);
  assert.equal(Object.isFrozen(topology.data[0].position), true);
  assert.equal(Object.isFrozen(payload.proposal), true);
  assert.equal(Object.isFrozen(payload.metrics.nested), true);

  scene.layers.topology[0].position.x = 99;
  scene.proposal.status = 'approved';
  scene.metrics.nested.horizon = 1;

  assert.equal(topology.data[0].position.x, 1);
  assert.equal(payload.proposal.status, 'advisory');
  assert.equal(payload.metrics.nested.horizon, 24);
  assert.equal(payload.payloadFingerprint, fingerprint);
  assert.equal(validateHolographicCanvaPayload(payload), true);
});

test('captures and freezes operator comparison state behind the view fingerprint', () => {
  const payload = buildHolographicCanvaPayload({
    scene: buildMutableScene(),
    target: 'holo-mat',
  });
  const mutablePayload = structuredClone(payload);
  assert.equal(validateHolographicCanvaPayload(mutablePayload), true);

  const view = buildHolographicOperatorView({ payload: mutablePayload });
  const fingerprint = view.viewFingerprint;
  const comparisonLayer = mutablePayload.layers.find(
    (layer) => layer.type === 'solverComparison',
  );

  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.source), true);
  assert.equal(Object.isFrozen(view.attention), true);
  assert.equal(Object.isFrozen(view.interactions), true);
  assert.equal(Object.isFrozen(view.comparison), true);
  assert.equal(Object.isFrozen(view.comparison.candidates), true);
  assert.equal(Object.isFrozen(view.comparison.candidates[0]), true);
  assert.equal(Object.isFrozen(view.comparison.metrics), true);
  assert.equal(Object.isFrozen(view.presentation), true);

  comparisonLayer.data[0].score = 99;
  mutablePayload.metrics.confidence = 0.99;

  assert.equal(view.comparison.candidates[0].score, 12);
  assert.equal(view.comparison.metrics.confidence, 0.82);
  assert.equal(view.viewFingerprint, fingerprint);
  assert.equal(validateHolographicOperatorView(view), true);
  assert.throws(() => {
    view.comparison.candidates[0].score = 101;
  }, TypeError);
});
