import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintHolographicCanvaScene, verifyHolographicCanvaScene } from '../../src/holographic-scene-fingerprint.mjs';

test('fingerprint is deterministic across key order', () => {
  const first = { sceneId: 'scene-1', layers: { topology: [{ z: 1, x: 2 }] } };
  const second = { layers: { topology: [{ x: 2, z: 1 }] }, sceneId: 'scene-1' };
  const fingerprint = fingerprintHolographicCanvaScene(first);
  assert.equal(verifyHolographicCanvaScene(second, fingerprint), true);
});

test('fingerprint rejects changed scene content', () => {
  const scene = { sceneId: 'scene-1', layers: {} };
  const fingerprint = fingerprintHolographicCanvaScene(scene);
  assert.equal(verifyHolographicCanvaScene({ ...scene, sceneId: 'scene-2' }, fingerprint), false);
});
