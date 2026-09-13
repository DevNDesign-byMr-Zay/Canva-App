import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHolographicCanvaPayload, validateHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';

const scene = {
  sceneVersion: 2,
  sceneId: 'scene-001',
  snapshotId: 'snapshot-001',
  rendererContract: { mode: 'renderer-neutral', authoritativeSource: 'thergrid-decision-receipt' },
  layers: {
    topology: true,
    powerFlows: true,
    forecastDelta: true,
    simulationEvidence: true,
    alerts: [],
    attention: [{ id: 'attention-1', priority: 1, severity: 'info', reason: 'Review forecast', evidenceRef: 'receipt-1', advisoryOnly: true }],
    provenance: true,
  },
  provenanceRef: 'experiment-001',
};

test('builds deterministic Canva payloads for supported holographic targets', () => {
  const first = buildHolographicCanvaPayload({ scene, target: 'holo-mat', designId: 'design-1' });
  const second = buildHolographicCanvaPayload({ scene, target: 'holo-mat', designId: 'design-1' });
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
  assert.throws(() => buildHolographicCanvaPayload({ scene, target: 'actuator' }), /unsupported holographic target/);
});

test('rejects scenes that are not THERGRID scene version 2', () => {
  assert.throws(() => buildHolographicCanvaPayload({ scene: { ...scene, sceneVersion: 1 } }), /sceneVersion must equal 2/);
});
