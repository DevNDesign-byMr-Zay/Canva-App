import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyHolographicInteraction,
  createHolographicViewState,
  HOLO_FRAME_SCHEMA,
  HOLO_VIEW_SCHEMA,
  projectHolographicFrame,
} from '../../src/holographic/interaction.mjs';
import { createHolographicScene } from '../../src/holographic/scene.mjs';

function buildScene() {
  return createHolographicScene({
    id: 'interactive-demo',
    nodes: [
      { id: 'backdrop', kind: 'image', depth: -2, transform: { x: 0, y: 0, z: -2 } },
      { id: 'hero', kind: 'model', depth: 2, transform: { x: 3, y: 1, z: 2 } },
      { id: 'hidden', kind: 'image', depth: 4, visible: false },
    ],
  });
}

test('creates an immutable renderer-neutral 3D view state', () => {
  const view = createHolographicViewState(buildScene());

  assert.equal(view.schema, HOLO_VIEW_SCHEMA);
  assert.deepEqual(view.camera, {
    yaw: 0,
    pitch: -8,
    distance: 6,
    target: { x: 0, y: 0, z: 0 },
  });
  assert(Object.isFrozen(view));
  assert(Object.isFrozen(view.camera));
  assert(Object.isFrozen(view.camera.target));
});

test('orbits, zooms, and pans with bounded camera values', () => {
  const scene = buildScene();
  let view = createHolographicViewState(scene);

  view = applyHolographicInteraction(scene, view, {
    type: 'orbit',
    deltaYaw: 725,
    deltaPitch: 200,
  });
  assert.equal(view.camera.yaw, 5);
  assert.equal(view.camera.pitch, 85);

  view = applyHolographicInteraction(scene, view, { type: 'zoom', delta: -50 });
  assert.equal(view.camera.distance, 1);

  view = applyHolographicInteraction(scene, view, { type: 'pan', x: 500, y: -500, z: 3 });
  assert.deepEqual(view.camera.target, { x: 100, y: -100, z: 3 });
});

test('selects and focuses only visible scene nodes', () => {
  const scene = buildScene();
  let view = createHolographicViewState(scene);

  view = applyHolographicInteraction(scene, view, { type: 'select', nodeId: 'hero' });
  assert.equal(view.selectedNodeId, 'hero');

  view = applyHolographicInteraction(scene, view, { type: 'focus', nodeId: 'hero' });
  assert.deepEqual(view.camera.target, { x: 3, y: 1, z: 2 });
  assert.throws(
    () => applyHolographicInteraction(scene, view, { type: 'select', nodeId: 'hidden' }),
    /Visible scene node not found/,
  );
});

test('projects deterministic visible layers for a 3D renderer', () => {
  const scene = buildScene();
  const view = applyHolographicInteraction(
    scene,
    createHolographicViewState(scene),
    { type: 'select', nodeId: 'hero' },
  );
  const frame = projectHolographicFrame(scene, view);

  assert.equal(frame.schema, HOLO_FRAME_SCHEMA);
  assert.deepEqual(
    frame.layers.map((layer) => layer.id),
    ['backdrop', 'hero'],
  );
  assert.equal(frame.layers[1].selected, true);
  assert.deepEqual(frame.layers[1].position, { x: 3, y: 1, z: 2 });
  assert(Object.isFrozen(frame.layers));
});

test('rejects mismatched scenes and unsupported interactions', () => {
  const scene = buildScene();
  const view = createHolographicViewState(scene);
  const otherScene = createHolographicScene({ id: 'other' });

  assert.throws(() => projectHolographicFrame(otherScene, view), /belong to the supplied scene/);
  assert.throws(
    () => applyHolographicInteraction(scene, view, { type: 'teleport' }),
    /Unsupported holographic interaction/,
  );
});
