import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyHolographicInteraction,
  createHolographicViewState,
  projectHolographicFrame,
} from '../../src/holographic/interaction.mjs';
import { buildCss3dRenderModel, HOLO_RENDER_SCHEMA } from '../../src/holographic/renderer.mjs';
import { createHolographicScene } from '../../src/holographic/scene.mjs';

function frameForDemo() {
  const scene = createHolographicScene({
    id: 'render-demo',
    nodes: [
      {
        id: 'backdrop',
        kind: 'image',
        depth: -2,
        transform: { x: 0, y: 0, z: -2, scale: 1.25 },
      },
      {
        id: 'hero',
        kind: 'model',
        depth: 2,
        transform: { x: 3, y: 1, z: 2, ry: 15 },
      },
    ],
  });
  let view = createHolographicViewState(scene, { yaw: 20, pitch: -10, distance: 7 });
  view = applyHolographicInteraction(scene, view, { type: 'select', nodeId: 'hero' });
  return projectHolographicFrame(scene, view);
}

test('projects a modern CSS3D scene without duplicating camera state', () => {
  const model = buildCss3dRenderModel(frameForDemo());

  assert.equal(model.schema, HOLO_RENDER_SCHEMA);
  assert.equal(model.sceneId, 'render-demo');
  assert.equal(model.selectedNodeId, 'hero');
  assert.equal(model.viewportStyle.perspective, '900px');
  assert.match(model.cameraStyle.transform, /translate3d\(/);
  assert.match(model.cameraStyle.transform, /rotateX\(-10deg\)/);
  assert.match(model.cameraStyle.transform, /rotateY\(-20deg\)/);
  assert.equal(model.layers.length, 2);
  assert.equal(model.layers[1].attributes['data-holo-selected'], 'true');
  assert.match(model.layers[1].style.transform, /translate3d\(120px, -40px, 80px\)/);
  assert.match(model.layers[1].style.transform, /rotateY\(15deg\)/);
});

test('keeps depth ordering deterministic and exposes renderer hooks', () => {
  const model = buildCss3dRenderModel(frameForDemo(), { unit: 24, perspective: 720 });

  assert.deepEqual(
    model.layers.map((layer) => layer.id),
    ['backdrop', 'hero'],
  );
  assert.equal(model.layers[0].style.zIndex, '1');
  assert.equal(model.layers[1].style.zIndex, '2');
  assert.equal(model.layers[0].attributes['data-holo-kind'], 'image');
  assert.equal(model.perspective, 720);
  assert.equal(model.unit, 24);
});

test('bounds renderer scale and can disable motion for reduced-motion surfaces', () => {
  const model = buildCss3dRenderModel(frameForDemo(), {
    unit: 1000,
    perspective: 10,
    motion: false,
  });

  assert.equal(model.unit, 160);
  assert.equal(model.perspective, 240);
  assert.equal(model.cameraStyle.transition, 'none');
  assert.equal(model.layers[0].style.transition, 'none');
  assert.equal(model.layers[0].style.willChange, 'auto');
});

test('rejects non-projected scene data at the renderer boundary', () => {
  assert.throws(() => buildCss3dRenderModel({}), /valid projected holographic frame/);
});
