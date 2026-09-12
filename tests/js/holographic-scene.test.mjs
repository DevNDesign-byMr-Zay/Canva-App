import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHolographicScene, planFromCanvaAssets } from '../../src/holographic/scene.mjs';

test('creates a versioned holographic scene', () => {
  const scene = createHolographicScene({
    id: 'poster-1',
    nodes: [
      { id: 'title', depth: 2 },
      { id: 'hidden', visible: false },
    ],
  });
  assert.equal(scene.schema, 'holo.scene.v1');
  assert.equal(scene.nodes[0].depth, 2);
  assert.equal(scene.nodes[0].visible, true);
  assert.equal(scene.nodes[1].visible, false);
});

test('maps Canva assets into deterministic scene nodes', () => {
  const scene = planFromCanvaAssets([
    { id: 'logo', visible: false },
    { id: 'product', depth: 4 },
  ]);
  assert.deepEqual(scene.nodes.map((node) => node.id), ['logo', 'product']);
  assert.deepEqual(scene.nodes.map((node) => node.depth), [0, 4]);
  assert.deepEqual(scene.nodes.map((node) => node.visible), [false, true]);
});
