import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpatialGraph } from '../../packages/holoforge/spatial-graph.mjs';

test('creates deterministic 2.5D relationships from a design snapshot', () => {
  const graph = createSpatialGraph({
    designRef: 'design-001',
    elements: [
      { id: 'hero', x: 0, y: 0, width: 100, height: 100, z: 1 },
      { id: 'label', x: 50, y: 50, width: 40, height: 40, z: 2 },
    ],
  });

  assert.equal(graph.schema, 'holoforge.spatial-graph');
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.relationships.length, 1);
  assert.equal(graph.relationships[0].overlapArea, 1600);
  assert.equal(graph.relationships[0].depthDelta, 1);
});

test('rejects duplicate element identifiers', () => {
  assert.throws(() => createSpatialGraph({
    designRef: 'design-001',
    elements: [
      { id: 'same', x: 0, y: 0, width: 10, height: 10 },
      { id: 'same', x: 20, y: 0, width: 10, height: 10 },
    ],
  }), /duplicate element id/);
});
