import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCanvaHolographicInteractions, HOLOGRAPHIC_INTERACTION_ACTIONS } from '../../src/holographic-interaction-map.mjs';
import { buildHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';

test('public interaction mapper preserves advisory interaction semantics', () => {
  const payload = buildHolographicCanvaPayload({
    sceneVersion: 2,
    designId: 'design-1',
    snapshotId: 'snapshot-1',
    sceneIdentity: 'scene-1',
    provenanceRef: 'prov-1',
    target: 'projector',
    topology: [{ id: 'node-1', canvaElementId: 'el-1', role: 'button', interaction: { action: 'inspect' }, x: 1, y: 2, z: 3 }],
  });
  const interactions = mapCanvaHolographicInteractions(payload);
  assert.deepEqual(interactions[0], { canvaElementId: 'el-1', target: 'el-1', action: 'inspect', advisoryOnly: true, physicalActuation: false });
  assert.ok(HOLOGRAPHIC_INTERACTION_ACTIONS.includes('inspect'));
});
