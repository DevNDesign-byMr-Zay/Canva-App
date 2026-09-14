import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHolographicCanvaPayload,
  TARGETS,
  validateHolographicCanvaPayload,
} from '../../src/holographic-scene-adapter.mjs';

const EXPECTED_TARGETS = Object.freeze([
  'holo-mat',
  'projector',
  'volumetric-3d',
  'ar-vr',
  'web-dashboard',
]);

const scene = {
  sceneVersion: 2,
  sceneId: 'scene-001',
  snapshotId: 'snapshot-001',
  rendererContract: {
    mode: 'renderer-neutral',
    authoritativeSource: 'thergrid-decision-receipt',
  },
  layers: {
    topology: true,
    powerFlows: true,
    forecastDelta: true,
    simulationEvidence: true,
    alerts: [],
    attention: [
      {
        id: 'attention-1',
        priority: 1,
        severity: 'info',
        reason: 'Review forecast',
        evidenceRef: 'receipt-1',
        advisoryOnly: true,
      },
    ],
    provenance: true,
  },
  provenanceRef: 'experiment-001',
};

test('builds deterministic Canva payloads for supported holographic targets', () => {
  const first = buildHolographicCanvaPayload({
    scene,
    target: 'holo-mat',
    designId: 'design-1',
  });
  const second = buildHolographicCanvaPayload({
    scene,
    target: 'holo-mat',
    designId: 'design-1',
  });
  assert.deepEqual(first, second);
  assert.equal(first.target, 'holo-mat');
  assert.equal(first.authoritativeSource, 'thergrid-decision-receipt');
  assert.equal(first.safety.authoritative, false);
  assert.equal(first.safety.physicalActuation, false);
  assert.equal(validateHolographicCanvaPayload(first), true);
});

test('keeps provenance and advisory attention when projecting into Canva', () => {
  const payload = buildHolographicCanvaPayload({ scene, target: 'projector' });
  assert.equal(payload.provenanceRef, 'experiment-001');
  assert.equal(payload.attention[0].evidenceRef, 'receipt-1');
  assert.equal(payload.attention[0].advisoryOnly, true);
});

test('rejects unsupported render targets', () => {
  assert.throws(
    () => buildHolographicCanvaPayload({ scene, target: 'actuator' }),
    /unsupported holographic target/,
  );
});

test('pins and supports every renderer-neutral holographic target', () => {
  assert.deepEqual(TARGETS, EXPECTED_TARGETS);
  for (const target of EXPECTED_TARGETS) {
    const payload = buildHolographicCanvaPayload({ scene, target });
    assert.equal(payload.target, target);
    assert.equal(validateHolographicCanvaPayload(payload), true, target);
  }
});

test('rejects scenes that are not THERGRID scene version 2', () => {
  assert.throws(
    () => buildHolographicCanvaPayload({ scene: { ...scene, sceneVersion: 1 } }),
    /sceneVersion must equal 2/,
  );
});

test('rejects payloads with blank identity or provenance fields', () => {
  const payload = buildHolographicCanvaPayload({ scene });
  for (const field of ['snapshotId', 'sceneIdentity', 'provenanceRef']) {
    const invalid = { ...payload, [field]: '   ' };
    assert.equal(validateHolographicCanvaPayload(invalid), false, field);
  }
});

test('rejects malformed payload fingerprints at the adapter boundary', () => {
  const payload = buildHolographicCanvaPayload({ scene });
  for (const fingerprint of ['', 'not-a-digest', 'A'.repeat(64), '0'.repeat(63)]) {
    assert.equal(
      validateHolographicCanvaPayload({ ...payload, payloadFingerprint: fingerprint }),
      false,
    );
  }
});

test('rejects payloads whose content no longer matches the fingerprint', () => {
  const payload = buildHolographicCanvaPayload({
    scene,
    target: 'projector',
    designId: 'design-1',
  });
  const tampered = { ...payload, target: 'holo-mat' };
  assert.equal(validateHolographicCanvaPayload(tampered), false);
  assert.equal(validateHolographicCanvaPayload(payload), true);
});

test('rejects tampering across the complete payload and safety contract', () => {
  const enrichedScene = {
    ...scene,
    proposal: { id: 'proposal-1', status: 'advisory' },
    metrics: { confidence: 0.82, horizon: 24 },
  };
  const payload = buildHolographicCanvaPayload({
    scene: enrichedScene,
    target: 'projector',
    designId: 'design-1',
  });

  const tamperedCases = [
    ['adapterVersion', { ...payload, adapterVersion: payload.adapterVersion + 1 }],
    ['authoritativeSource', { ...payload, authoritativeSource: 'alternate-source' }],
    ['designId', { ...payload, designId: 'design-2' }],
    ['snapshotId', { ...payload, snapshotId: 'snapshot-tampered' }],
    ['sceneIdentity', { ...payload, sceneIdentity: 'scene-tampered' }],
    ['proposal', { ...payload, proposal: { ...payload.proposal, status: 'approved' } }],
    ['metrics', { ...payload, metrics: { ...payload.metrics, confidence: 0.99 } }],
    [
      'attention',
      {
        ...payload,
        attention: [
          { ...payload.attention[0], reason: 'tampered attention' },
          ...payload.attention.slice(1),
        ],
      },
    ],
    [
      'layers',
      {
        ...payload,
        layers: payload.layers.map((layer) =>
          layer.id === 'topology' ? { ...layer, data: { tampered: true } } : layer,
        ),
      },
    ],
    ['target', { ...payload, target: 'holo-mat' }],
    ['provenanceRef', { ...payload, provenanceRef: 'experiment-tampered' }],
    [
      'safety.authoritative',
      { ...payload, safety: { ...payload.safety, authoritative: true } },
    ],
    [
      'safety.physicalActuation',
      { ...payload, safety: { ...payload.safety, physicalActuation: true } },
    ],
    [
      'safety.provenanceRequired',
      { ...payload, safety: { ...payload.safety, provenanceRequired: false } },
    ],
  ];

  for (const [field, candidate] of tamperedCases) {
    assert.equal(validateHolographicCanvaPayload(candidate), false, field);
  }
  assert.equal(validateHolographicCanvaPayload(payload), true);
});

test('preserves proposal and metrics payload data without weakening safety flags', () => {
  const enrichedScene = {
    ...scene,
    proposal: { id: 'proposal-1', status: 'advisory' },
    metrics: { confidence: 0.82, horizon: 24 },
  };
  const payload = buildHolographicCanvaPayload({
    scene: enrichedScene,
    target: 'web-dashboard',
  });
  assert.deepEqual(payload.proposal, enrichedScene.proposal);
  assert.deepEqual(payload.metrics, enrichedScene.metrics);
  assert.equal(payload.safety.authoritative, false);
  assert.equal(payload.safety.physicalActuation, false);
  assert.equal(payload.safety.provenanceRequired, true);
});

test('captures nested payload state so caller mutation cannot drift behind the fingerprint', () => {
  const mutableScene = {
    ...scene,
    layers: {
      ...scene.layers,
      topology: [{ id: 'node-1', position: { x: 1, y: 2, z: 3 } }],
    },
    proposal: { id: 'proposal-1', status: 'advisory' },
    metrics: { confidence: 0.82, nested: { horizon: 24 } },
  };
  const payload = buildHolographicCanvaPayload({
    scene: mutableScene,
    target: 'web-dashboard',
  });
  const topology = payload.layers.find((layer) => layer.id === 'topology');
  const fingerprint = payload.payloadFingerprint;

  assert.equal(Object.isFrozen(payload.layers), true);
  assert.equal(Object.isFrozen(topology), true);
  assert.equal(Object.isFrozen(topology.data), true);
  assert.equal(Object.isFrozen(topology.data[0].position), true);
  assert.equal(Object.isFrozen(payload.proposal), true);
  assert.equal(Object.isFrozen(payload.metrics.nested), true);

  mutableScene.layers.topology[0].position.x = 99;
  mutableScene.proposal.status = 'approved';
  mutableScene.metrics.nested.horizon = 1;

  assert.equal(topology.data[0].position.x, 1);
  assert.equal(payload.proposal.status, 'advisory');
  assert.equal(payload.metrics.nested.horizon, 24);
  assert.equal(payload.payloadFingerprint, fingerprint);
  assert.equal(validateHolographicCanvaPayload(payload), true);
});
