import { createHolographicScene, planFromCanvaAssets } from '../../src/holographic/scene.mjs';

describe('Canva holographic scene planner', () => {
  test('creates a versioned holographic scene', () => {
    const scene = createHolographicScene({ id: 'poster-1', nodes: [{ id: 'title', depth: 2 }] });
    expect(scene.schema).toBe('holo.scene.v1');
    expect(scene.nodes[0].depth).toBe(2);
  });

  test('maps Canva assets into deterministic scene nodes', () => {
    const scene = planFromCanvaAssets([{ id: 'logo' }, { id: 'product', depth: 4 }]);
    expect(scene.nodes.map((node) => node.id)).toEqual(['logo', 'product']);
    expect(scene.nodes.map((node) => node.depth)).toEqual([0, 4]);
  });
});
