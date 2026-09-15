import test from 'node:test';
import assert from 'node:assert/strict';

import {
  projectDesignConfig,
  reconstructSourceConfig,
} from '../../prototype/holoforge/geometry.js';

test('reconstruction rejects malformed optional geometry instead of coercing it', () => {
  assert.throws(() => reconstructSourceConfig({ x: 10, y: 10, z: Infinity }, {}), /candidate z must be finite/);
  assert.throws(() => reconstructSourceConfig({ x: 10, y: 10, scale: '1' }, {}), /candidate scale must be finite/);
  assert.throws(() => reconstructSourceConfig({ x: 10, y: 10 }, { x: NaN }), /delta x must be finite/);
  assert.throws(() => reconstructSourceConfig({ x: 10, y: 10 }, { z: '2' }), /delta z must be finite/);
  assert.throws(() => reconstructSourceConfig({ x: 10, y: 10 }, { scale: Infinity }), /delta scale must be finite/);
});

test('projection rejects malformed optional z and scale values', () => {
  assert.throws(() => projectDesignConfig({ x: 10, y: 10, z: NaN }), /config z must be finite/);
  assert.throws(() => projectDesignConfig({ x: 10, y: 10, scale: '1' }), /config scale must be finite/);
});
