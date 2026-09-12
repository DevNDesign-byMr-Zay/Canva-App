import assert from 'node:assert/strict';
import test from 'node:test';

import { exportHolographicScene } from '../../src/holographic/export.mjs';
import { simulateHolographicScene } from '../../src/holographic/simulator.mjs';
import { planFromCanvaAssets } from '../../src/holographic/scene.mjs';

test('simulates a Canva-derived scene before versioned export', () => {
  const scene = planFromCanvaAssets([{ id: 'hero', kind: 'image' }], {
    sceneId: 'product-demo',
  });
  const receipt = simulateHolographicScene(scene, { targetId: 'holomat-1' });
  const exported = exportHolographicScene(scene);
  const payload = JSON.parse(exported.content);

  assert.equal(receipt.status, 'simulated');
  assert.deepEqual(receipt.renderedNodes, ['hero']);
  assert.equal(exported.payload.sourceSchema, 'holo.scene.v1');
  assert.equal(exported.format, 'json');
  assert.equal(payload.scene.id, 'product-demo');
});
