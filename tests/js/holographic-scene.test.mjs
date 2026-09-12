import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHolographicScene, planFromCanvaAssets } from '../../src/holographic/scene.mjs';

describe('Canva holographic scene planner', () => {
  test('creates a versioned holographic scene', () => {
    const scene = createHolographicScene({ id: 'poster-1', nodes: [{ id: 'title', depth: 2 }] });
    assert.equal(scene.schema, 'holo.scene.v1');
    assert.equal(scene.nodes[0].depth, 2);
  });

  test('maps Canva assets into deterministic scene nodes', () => {
    const scene = planFromCanvaAssets([{ id: 'logo' }, { id: 'product', depth: 4 }]);
    assert.deepEqual(scene.nodes.map((node) => node.id), ['logo', 'product']);
    assert.deepEqual(scene.nodes.map((node) => node.depth), [0, 4]);
  });
});
