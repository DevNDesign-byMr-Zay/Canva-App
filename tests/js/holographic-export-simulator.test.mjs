import assert from 'node:assert/strict';
import test from 'node:test';

import { exportHolographicScene } from '../../src/holographic/export.mjs';
import { simulateHolographicScene } from '../../src/holographic/simulator.mjs';
import { createHolographicScene } from '../../src/holographic/scene.mjs';

test('simulates a Canva-derived scene before versioned export', () => {
  const scene = createHolographicScene({
    id: 'product-demo',
    assets: [{ id: 'hero', type: 'image' }],
  });
  const receipt = simulateHolographicScene(scene, { targetId: 'holomat-1' });
  const exported = exportHolographicScene(scene);

  assert.equal(receipt.status, 'simulated');
  assert.deepEqual(receipt.visibleNodeIds, ['hero']);
  assert.equal(exported.sourceSchema, 'holo.scene.v1');
  assert.equal(exported.format, 'json');
  assert.equal(JSON.parse(exported.content).scene.id, 'product-demo');
});
