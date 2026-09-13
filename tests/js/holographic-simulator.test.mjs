import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHolographicScene } from '../../src/holographic/scene.mjs';
import { simulateHolographicScene } from '../../src/holographic/simulator.mjs';

test('simulates visible scene nodes deterministically', () => {
  const scene = createHolographicScene({
    id: 'demo',
    nodes: [
      { id: 'logo' },
      { id: 'hidden', depth: 2, visible: false },
      { id: 'product', depth: 4 },
    ],
  });
  const receipt = simulateHolographicScene(scene, { targetId: 'holo-mat-01' });
  assert.deepEqual(receipt, {
    targetId: 'holo-mat-01',
    sceneId: 'demo',
    schema: 'holo.scene.v1',
    status: 'simulated',
    renderedNodes: ['logo', 'product'],
  });
});

test('rejects invalid scene specifications', () => {
  assert.throws(() => simulateHolographicScene(null), /valid holographic scene/);
});
