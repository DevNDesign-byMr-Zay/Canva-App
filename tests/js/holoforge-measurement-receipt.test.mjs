import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlacementQubo } from '../../packages/holoforge/placement-objective.mjs';
import { createSpatialGraph } from '../../packages/holoforge/spatial-graph.mjs';
import { createMeasurementReceipt } from '../../packages/holoforge/measurement-receipt.mjs';

test('measurement receipt compares candidate against exact reference', () => {
  const graph = createSpatialGraph({
    nodes: [
      { id: 'a', x: 0, y: 0, width: 20, height: 20, z: 0 },
      { id: 'b', x: 10, y: 10, width: 20, height: 20, z: 0 },
    ],
  });
  const qubo = buildPlacementQubo(graph);
  const receipt = createMeasurementReceipt({ qubo, seed: 7, iterations: 64, durationMs: 3 });

  assert.equal(receipt.schema, 'holoforge-measurement-receipt-v0');
  assert.equal(receipt.problem.variableCount, 2);
  assert.equal(receipt.reference.algorithm, 'exhaustive-binary-search');
  assert.equal(receipt.candidate.seed, 7);
  assert.equal(receipt.comparison.objectiveGap >= 0, true);
  assert.equal(receipt.durationMs, 3);
});

test('exact reference remains deterministic', () => {
  const graph = createSpatialGraph({ nodes: [{ id: 'a', x: 0, y: 0, width: 10, height: 10, z: 2 }] });
  const qubo = buildPlacementQubo(graph);
  const first = createMeasurementReceipt({ qubo, seed: 1, iterations: 8, durationMs: 0 });
  const second = createMeasurementReceipt({ qubo, seed: 1, iterations: 8, durationMs: 0 });
  assert.deepEqual(first.reference.bits, second.reference.bits);
  assert.equal(first.reference.objective, second.reference.objective);
});
