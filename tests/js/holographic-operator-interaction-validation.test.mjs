import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

const base = {
  viewVersion: 4,
  source: { snapshotId: 'snapshot-1', sceneId: 'scene-1', provenanceRef: 'prov-1', payloadFingerprint: 'a'.repeat(64) },
  target: 'holo-mat',
  attention: [],
  interactions: [{ canvaElementId: 'el-1', target: 'el-1', action: 'inspect', advisoryOnly: true, physicalActuation: false }],
  comparison: { candidateCount: 0, candidates: [], metrics: null },
  presentation: { mode: 'operator-advisory', interaction: 'presentation-only', authoritative: false, physicalActuation: false },
  viewFingerprint: 'b'.repeat(64),
};

test('rejects unsupported interaction actions', () => {
  assert.equal(validateHolographicOperatorView({ ...base, interactions: [{ ...base.interactions[0], action: 'execute' }] }), false);
});

test('rejects empty interaction targets', () => {
  assert.equal(validateHolographicOperatorView({ ...base, interactions: [{ ...base.interactions[0], target: ' ' }] }), false);
});
