import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

test('operator view carries Canva interactions as presentation-only controls', () => {
  const payload = buildHolographicCanvaPayload({
    sceneVersion: 2,
    designId: 'design-interactions',
    snapshotId: 'snapshot-interactions',
    sceneIdentity: 'scene-interactions',
    provenanceRef: 'prov-interactions',
    target: 'holo-mat',
    topology: [{ id: 'node-1', canvaElementId: 'button-1', role: 'button', interaction: { action: 'select', target: 'button-1' }, x: 0, y: 0, z: 1 }],
  });
  const view = buildHolographicOperatorView({ payload });
  assert.equal(view.interactions.length, 1);
  assert.equal(view.interactions[0].action, 'select');
  assert.equal(view.interactions[0].target, 'button-1');
  assert.equal(view.interactions[0].advisoryOnly, true);
  assert.equal(view.interactions[0].physicalActuation, false);
  assert.equal(validateHolographicOperatorView(view), true);
});
