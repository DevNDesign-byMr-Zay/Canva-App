import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulatorDisplayAdapter, composeCanvaPresentation } from '../../src/holographic/index.mjs';

test('composes a Canva design into a versioned holographic scene', () => {
  const result = composeCanvaPresentation({
    designId: 'poster-42',
    assets: [{ id: 'hero', kind: 'image', depth: 0.4 }],
  });

  assert.equal(result.source.provider, 'canva');
  assert.equal(result.scene.schema, 'holo.scene.v1');
  assert.equal(result.scene.nodes.length, 1);
});

test('simulator executes the same scene contract used by physical adapters', () => {
  const scene = composeCanvaPresentation({ designId: 'demo', assets: [] }).scene;
  const receipt = new SimulatorDisplayAdapter().execute(scene);

  assert.equal(receipt.status, 'simulated');
  assert.equal(receipt.sceneId, 'canva-demo');
  assert.equal(receipt.nodeCount, 0);
});
