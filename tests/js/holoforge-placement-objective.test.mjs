import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpatialGraph } from '../../packages/holoforge/spatial-graph.mjs';
import { buildPlacementQubo } from '../../packages/holoforge/placement-objective.mjs';

test('builds a bounded QUBO from overlapping spatial nodes', () => {
  const graph = createSpatialGraph({
    designRef: 'design-001',
    elements: [
      { id: 'a', x: 0, y: 0, width: 100, height: 100, z: 0 },
      { id: 'b', x: 50, y: 50, width: 40, height: 40, z: 0 },
    ],
  });
  const qubo = buildPlacementQubo(graph);

  assert.equal(qubo.kind, 'qubo');
  assert.equal(qubo.variableCount, 2);
  assert.equal(qubo.linear.length, 2);
  assert.equal(qubo.quadratic.length, 1);
  assert.equal(qubo.quadratic[0].coefficient, 16000);
  assert.equal(qubo.objective.direction, 'minimize');
});

test('supports explicit zero weights without replacing them with defaults', () => {
  const graph = createSpatialGraph({
    designRef: 'design-002',
    elements: [{ id: 'a', x: 0, y: 0, width: 10, height: 10, z: 0 }],
  });
  const qubo = buildPlacementQubo(graph, { overlapWeight: 0, depthWeight: 0, movementWeight: 0 });
  assert.deepEqual(qubo.linear, [0]);
  assert.deepEqual(qubo.objective.weights, { overlap: 0, depth: 0, movement: 0 });
});
