import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOptimizationFingerprint } from '../../src/holoforge-scenario-contract.mjs';
import { hierarchyScenario } from '../../src/holoforge-fixtures.mjs';

test('equivalent constraint sets ignore array order', () => {
  const reordered = structuredClone(hierarchyScenario);
  reordered.constraints.hard.reverse();

  assert.equal(
    computeOptimizationFingerprint(reordered),
    computeOptimizationFingerprint(hierarchyScenario),
  );
});

test('hard and soft classification remains part of optimization identity', () => {
  const reclassified = structuredClone(hierarchyScenario);
  const [constraint] = reclassified.constraints.hard.splice(0, 1);
  reclassified.constraints.soft.push(constraint);

  assert.notEqual(
    computeOptimizationFingerprint(reclassified),
    computeOptimizationFingerprint(hierarchyScenario),
  );
});
