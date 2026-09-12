import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHolographicControlAdapter,
  HOLO_CONTROLS_SCHEMA,
} from '../../src/holographic/controls.mjs';

test('maps pointer drag to deterministic orbit and pan actions', () => {
  const controls = createHolographicControlAdapter();

  assert.equal(controls.schema, HOLO_CONTROLS_SCHEMA);
  assert.deepEqual(
    controls.fromPointerDrag({ deltaX: 25, deltaY: -10 }),
    { type: 'orbit', deltaYaw: 5, deltaPitch: -2 },
  );
  assert.deepEqual(
    controls.fromPointerDrag({ deltaX: 20, deltaY: -30, mode: 'pan' }),
    { type: 'pan', x: -0.2, y: -0.3, z: 0 },
  );
});

test('maps wheel input to bounded-view zoom actions without owning camera state', () => {
  const controls = createHolographicControlAdapter({ zoomSensitivity: 0.005 });

  assert.deepEqual(controls.fromWheel({ deltaY: 120 }), { type: 'zoom', delta: 0.6 });
  assert(Object.isFrozen(controls.fromWheel({ deltaY: -120 })));
});

test('provides keyboard-equivalent orbit pan zoom and clear-selection controls', () => {
  const controls = createHolographicControlAdapter();

  assert.deepEqual(controls.fromKey({ key: 'ArrowLeft' }), {
    type: 'orbit',
    deltaYaw: -8,
    deltaPitch: 0,
  });
  assert.deepEqual(controls.fromKey({ key: 'ArrowRight', shiftKey: true }), {
    type: 'pan',
    x: 0.4,
    y: 0,
    z: 0,
  });
  assert.deepEqual(controls.fromKey({ key: '+' }), { type: 'zoom', delta: -0.75 });
  assert.deepEqual(controls.fromKey({ key: 'Escape' }), { type: 'clear-selection' });
  assert.equal(controls.fromKey({ key: 'Tab' }), null);
});

test('maps accessible activation to select or focus without DOM coupling', () => {
  const controls = createHolographicControlAdapter();

  assert.deepEqual(controls.fromActivation({ nodeId: ' hero ' }), {
    type: 'select',
    nodeId: 'hero',
  });
  assert.deepEqual(controls.fromActivation({ nodeId: 'hero', focus: true }), {
    type: 'focus',
    nodeId: 'hero',
  });
  assert.throws(() => controls.fromActivation({ nodeId: ' ' }), /node id is required/i);
});

test('fails closed for unsupported pointer control modes', () => {
  const controls = createHolographicControlAdapter();

  assert.throws(
    () => controls.fromPointerDrag({ deltaX: 1, mode: 'teleport' }),
    /Unsupported pointer control mode/,
  );
});
