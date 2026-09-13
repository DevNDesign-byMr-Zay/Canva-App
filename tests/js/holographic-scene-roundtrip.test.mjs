import test from 'node:test';
import assert from 'node:assert/strict';
import { compileValidatedCanvaHolographicRoundtrip } from '../../src/holographic-scene-roundtrip.mjs';

const modelOutput = {
  intentVersion: 1,
  sceneId: 'scene-roundtrip',
  target: 'volumetric-3d',
  intent: 'highlight energy flow',
  nodes: [{ id: 'layer-1', kind: 'shape', canvaElementId: 'el-1', role: 'source', x: 1, y: 2, z: 3 }],
  attention: [{ priority: 1, severity: 'info', reason: 'reference signal' }],
};

test('AI Canva roundtrip produces validated payload and deterministic fingerprint', () => {
  const result = compileValidatedCanvaHolographicRoundtrip({ modelOutput, snapshotId: 'snapshot-1', provenanceRef: 'prov-1', designId: 'design-1' });
  assert.equal(result.payload.target, 'volumetric-3d');
  assert.equal(result.payload.designId, 'design-1');
  assert.match(result.sceneFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.safety.authoritative, false);
  assert.equal(result.safety.physicalActuation, false);
  assert.equal(result.safety.advisoryOnly, true);
});
