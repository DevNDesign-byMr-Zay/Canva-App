import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';
import {
  buildHolographicOperatorView,
  validateHolographicOperatorView,
} from '../../src/holographic-operator-view.mjs';

const scene = {
  sceneVersion: 2,
  snapshotId: 'snapshot-operator-001',
  sceneId: 'scene-operator-001',
  provenanceRef: 'experiment-operator-001',
  rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
  layers: {
    topology: { nodes: 3 },
    attention: [
      {
        priority: 20,
        severity: 'warning',
        reason: 'load approaching limit',
        evidenceRef: 'evidence-2',
        advisoryOnly: true,
      },
      {
        priority: 10,
        severity: 'high',
        reason: 'renewable forecast deviation',
        evidenceRef: 'evidence-1',
        advisoryOnly: true,
      },
    ],
    solverComparison: [
      { candidate: 'classical-reference' },
      { candidate: 'quantum-inspired' },
    ],
  },
  metrics: { generationKw: 40, loadKw: 50, renewableShare: 0.8 },
};

test('builds deterministic operator advisory ordering', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'holo-mat' });
  const first = buildHolographicOperatorView({ payload });
  const second = buildHolographicOperatorView({ payload });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.attention.map((item) => item.evidenceRef),
    ['evidence-1', 'evidence-2'],
  );
  assert.equal(first.target, 'holo-mat');
  assert.equal(first.presentation.authoritative, false);
  assert.equal(first.presentation.physicalActuation, false);
  assert.equal(validateHolographicOperatorView(first), true);
});

test('snapshots and freezes nested operator comparison state behind the fingerprint', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'holo-mat' });
  const mutablePayload = JSON.parse(JSON.stringify(payload));
  const view = buildHolographicOperatorView({ payload: mutablePayload });
  const fingerprint = view.viewFingerprint;

  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.source), true);
  assert.equal(Object.isFrozen(view.attention), true);
  assert.equal(Object.isFrozen(view.comparison), true);
  assert.equal(Object.isFrozen(view.comparison.candidates), true);
  assert.equal(Object.isFrozen(view.comparison.candidates[0]), true);
  assert.equal(Object.isFrozen(view.comparison.metrics), true);
  assert.equal(Object.isFrozen(view.presentation), true);

  mutablePayload.layers.find((layer) => layer.type === 'solverComparison').data[0].candidate =
    'tampered';
  mutablePayload.metrics.generationKw = 999;

  assert.equal(view.comparison.candidates[0].candidate, 'classical-reference');
  assert.equal(view.comparison.metrics.generationKw, 40);
  assert.equal(view.viewFingerprint, fingerprint);
  assert.equal(validateHolographicOperatorView(view), true);
  assert.throws(() => {
    view.comparison.candidates[0].candidate = 'mutated';
  }, TypeError);
});

test('rejects a tampered payload before projection', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'projector' });
  const tampered = { ...payload, sceneIdentity: 'scene-tampered' };
  assert.throws(
    () => buildHolographicOperatorView({ payload: tampered }),
    /integrity validation/,
  );
});

test('rejects an unsupported presentation target', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'web-dashboard' });
  assert.throws(
    () => buildHolographicOperatorView({ payload, target: 'unsupported-display' }),
    /unsupported holographic target/,
  );
});

test('rejects an attention item that claims authority', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'volumetric-3d' });
  const unsafe = {
    ...payload,
    attention: [{ ...payload.attention[0], advisoryOnly: false }],
  };
  assert.throws(
    () => buildHolographicOperatorView({ payload: unsafe }),
    /integrity validation/,
  );
});
