import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';
import {
  buildHolographicCanvaSceneBinding,
  validateHolographicCanvaSceneBinding,
} from '../../src/holographic-scene-binding.mjs';
import { fingerprintHolographicCanvaScene } from '../../src/holographic-scene-fingerprint.mjs';

const scene = {
  sceneVersion: 2,
  snapshotId: 'snapshot-binding-001',
  sceneId: 'scene-binding-001',
  provenanceRef: 'experiment-binding-001',
  rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
  layers: {
    topology: [{ id: 'node-1', kind: 'asset', position: { x: 1, y: 2, z: 3 } }],
    attention: [],
  },
  metrics: { confidence: 0.91 },
  proposal: null,
};

function buildFixture() {
  const payload = buildHolographicCanvaPayload({
    scene,
    target: 'web-dashboard',
    designId: 'design-binding-001',
  });
  const sceneFingerprint = fingerprintHolographicCanvaScene(scene);
  return { payload, sceneFingerprint };
}

test('binds scene and payload fingerprints to one trusted source identity', () => {
  const { payload, sceneFingerprint } = buildFixture();
  const binding = buildHolographicCanvaSceneBinding({ scene, payload, sceneFingerprint });

  assert.equal(binding.snapshotId, scene.snapshotId);
  assert.equal(binding.sceneId, scene.sceneId);
  assert.equal(binding.provenanceRef, scene.provenanceRef);
  assert.equal(binding.sceneFingerprint, sceneFingerprint);
  assert.equal(binding.payloadFingerprint, payload.payloadFingerprint);
  assert.equal(binding.target, 'web-dashboard');
  assert.equal(binding.designId, 'design-binding-001');
  assert.equal(binding.safety.authoritative, false);
  assert.equal(binding.safety.physicalActuation, false);
  assert.equal(validateHolographicCanvaSceneBinding(binding), true);
});

test('fails closed when scene identity does not match the payload', () => {
  const { payload } = buildFixture();
  const mismatchedScene = { ...scene, snapshotId: 'snapshot-other' };
  const sceneFingerprint = fingerprintHolographicCanvaScene(mismatchedScene);

  assert.throws(
    () => buildHolographicCanvaSceneBinding({ scene: mismatchedScene, payload, sceneFingerprint }),
    /snapshotId must match payload/,
  );
});

test('rejects stale or malformed scene fingerprints before binding', () => {
  const { payload, sceneFingerprint } = buildFixture();
  const tampered = `${sceneFingerprint.slice(0, -1)}${sceneFingerprint.endsWith('0') ? '1' : '0'}`;

  assert.throws(
    () => buildHolographicCanvaSceneBinding({ scene, payload, sceneFingerprint: tampered }),
    /scene fingerprint failed/,
  );
  assert.throws(
    () => buildHolographicCanvaSceneBinding({ scene, payload, sceneFingerprint: 'not-a-fingerprint' }),
    /sha256 fingerprint/,
  );
});

test('freezes binding evidence and detects later tampering', () => {
  const { payload, sceneFingerprint } = buildFixture();
  const binding = buildHolographicCanvaSceneBinding({ scene, payload, sceneFingerprint });

  assert.equal(Object.isFrozen(binding), true);
  assert.equal(Object.isFrozen(binding.safety), true);
  assert.throws(() => {
    binding.safety.authoritative = true;
  }, TypeError);
  assert.equal(validateHolographicCanvaSceneBinding({ ...binding, target: 'projector' }), false);
});

test('captures caller input before evaluating getters', () => {
  const { payload, sceneFingerprint } = buildFixture();
  let reads = 0;
  const input = { payload, sceneFingerprint };
  Object.defineProperty(input, 'scene', {
    enumerable: true,
    get() {
      reads += 1;
      return scene;
    },
  });

  assert.throws(
    () => buildHolographicCanvaSceneBinding(input),
    /must not use accessors/,
  );
  assert.equal(reads, 0);
});

test('binding validation rejects hidden schema widening instead of dropping it', () => {
  const { payload, sceneFingerprint } = buildFixture();
  const binding = buildHolographicCanvaSceneBinding({ scene, payload, sceneFingerprint });
  const prototypeNamed = JSON.parse('{"__proto__":{"hiddenAuthority":true}}');
  const forged = { ...binding, ...prototypeNamed };

  assert.equal(Object.hasOwn(forged, '__proto__'), true);
  assert.equal(validateHolographicCanvaSceneBinding(forged), false);
});
