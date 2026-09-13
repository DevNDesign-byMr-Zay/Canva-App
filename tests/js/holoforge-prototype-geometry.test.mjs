import test from 'node:test';
import assert from 'node:assert/strict';

import {
  projectDesignConfig,
  reconstructSourceConfig,
} from '../../prototype/holoforge/geometry.js';

test('hierarchy source geometry is reconstructed by reversing the candidate delta', () => {
  const source = reconstructSourceConfig(
    { x: 120, y: 130, z: 20, scale: 1.15 },
    { y: -18, scale: 0.15 },
  );

  assert.deepEqual(source, { x: 120, y: 148, z: 20, scale: 1 });
});

test('spacing source geometry reverses horizontal movement', () => {
  const source = reconstructSourceConfig(
    { x: 80, y: 190, z: 10 },
    { x: -12 },
  );

  assert.equal(source.x, 92);
  assert.equal(source.y, 190);
  assert.equal(source.scale, 1);
});

test('locked unchanged elements preserve identity and coordinates', () => {
  const source = reconstructSourceConfig(
    { x: 40, y: 40, z: 0, locked: true },
    {},
  );

  assert.equal(source.x, 40);
  assert.equal(source.y, 40);
  assert.equal(source.locked, true);
});

test('design coordinates project deterministically into percentages', () => {
  assert.deepEqual(
    projectDesignConfig({ x: 120, y: 250, z: 8, scale: 1.25 }),
    { leftPercent: 20, topPercent: 50, z: 8, scale: 1.25 },
  );
});

test('geometry projection rejects invalid spatial input', () => {
  assert.throws(() => reconstructSourceConfig({ x: NaN, y: 10 }, {}), /candidate x must be finite/);
  assert.throws(() => projectDesignConfig({ x: 10, y: 10 }, { width: 0, height: 500 }), /design dimensions/);
  assert.throws(() => reconstructSourceConfig({ x: 10, y: 10, scale: 0.5 }, { scale: 0.75 }), /source scale/);
});
