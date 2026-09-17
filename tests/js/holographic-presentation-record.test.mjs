import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHolographicOperatorView } from '../../src/holographic-operator-view.mjs';
import {
  buildHolographicPresentationRecord,
  validateHolographicPresentationRecord,
} from '../../src/holographic-presentation-record.mjs';
import { buildHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';
import { buildHolographicCanvaSceneBinding } from '../../src/holographic-scene-binding.mjs';
import { fingerprintHolographicCanvaScene } from '../../src/holographic-scene-fingerprint.mjs';

const scene = {
  sceneVersion: 2,
  snapshotId: 'snapshot-record-001',
  sceneId: 'scene-record-001',
  provenanceRef: 'experiment-record-001',
  rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
  layers: {
    topology: [{ id: 'node-1', kind: 'asset', position: { x: 1, y: 2, z: 3 } }],
    attention: [],
  },
  metrics: { confidence: 0.93 },
  proposal: null,
};

function buildFixture(target = 'web-dashboard') {
  const payload = buildHolographicCanvaPayload({ scene, target, designId: 'design-record-001' });
  const binding = buildHolographicCanvaSceneBinding({
    scene,
    payload,
    sceneFingerprint: fingerprintHolographicCanvaScene(scene),
  });
  const view = buildHolographicOperatorView({ payload });
  return { payload, binding, view };
}

test('binds operator presentation to validated scene and payload provenance', () => {
  const { binding, view } = buildFixture();
  const record = buildHolographicPresentationRecord({ binding, view });

  assert.equal(record.snapshotId, binding.snapshotId);
  assert.equal(record.sceneId, binding.sceneId);
  assert.equal(record.provenanceRef, binding.provenanceRef);
  assert.equal(record.designId, 'design-record-001');
  assert.equal(record.target, 'web-dashboard');
  assert.equal(record.bindingFingerprint, binding.bindingFingerprint);
  assert.equal(record.viewFingerprint, view.viewFingerprint);
  assert.equal(record.presentation.authoritative, false);
  assert.equal(record.presentation.physicalActuation, false);
  assert.equal(validateHolographicPresentationRecord(record), true);
});

test('rejects a valid operator view from another payload identity', () => {
  const { binding } = buildFixture('web-dashboard');
  const { view: otherView } = buildFixture('projector');

  assert.throws(
    () => buildHolographicPresentationRecord({ binding, view: otherView }),
    /payloadFingerprint must match binding/,
  );
});

test('freezes presentation evidence and detects record tampering', () => {
  const { binding, view } = buildFixture();
  const record = buildHolographicPresentationRecord({ binding, view });

  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.presentation), true);
  assert.throws(() => {
    record.presentation.authoritative = true;
  }, TypeError);
  assert.equal(validateHolographicPresentationRecord({ ...record, viewFingerprint: '0'.repeat(64) }), false);
});

test('captures presentation input before evaluating getters', () => {
  const { binding, view } = buildFixture();
  let reads = 0;
  const input = { binding };
  Object.defineProperty(input, 'view', {
    enumerable: true,
    get() {
      reads += 1;
      return view;
    },
  });

  assert.throws(() => buildHolographicPresentationRecord(input), /must not use accessors/);
  assert.equal(reads, 0);
});

test('record validation rejects hidden schema widening', () => {
  const { binding, view } = buildFixture();
  const record = buildHolographicPresentationRecord({ binding, view });
  const prototypeNamed = JSON.parse('{"__proto__":{"hiddenAuthority":true}}');
  const forged = { ...record, ...prototypeNamed };

  assert.equal(Object.hasOwn(forged, '__proto__'), true);
  assert.equal(validateHolographicPresentationRecord(forged), false);
});
