import assert from 'node:assert/strict';
import test from 'node:test';
import * as root from 'canva-depth-archive-tooling';
import * as sceneExport from 'canva-depth-archive-tooling/holographic-scene';
import * as viewExport from 'canva-depth-archive-tooling/holographic-operator-view';

const scene = {
  sceneVersion: 2,
  snapshotId: 'package-boundary-001',
  sceneId: 'scene-package-boundary-001',
  provenanceRef: 'experiment-package-boundary-001',
  rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
  layers: { topology: { nodes: 1 }, attention: [] },
};

test('public package exports expose the maintained holographic boundary', () => {
  assert.equal(root.buildHolographicCanvaPayload, sceneExport.buildHolographicCanvaPayload);
  assert.equal(typeof root.validateHolographicCanvaPayload, 'function');
  assert.equal(typeof sceneExport.buildHolographicCanvaPayload, 'function');
  assert.equal(typeof viewExport.buildHolographicOperatorView, 'function');
  assert.equal(typeof viewExport.validateHolographicOperatorView, 'function');

  const payload = root.buildHolographicCanvaPayload({ scene, target: 'web-dashboard' });
  const view = viewExport.buildHolographicOperatorView({ payload });
  assert.equal(root.validateHolographicCanvaPayload(payload), true);
  assert.equal(viewExport.validateHolographicOperatorView(view), true);
  assert.equal(view.source.snapshotId, scene.snapshotId);
  assert.equal(view.source.sceneId, scene.sceneId);
  assert.equal(view.source.provenanceRef, scene.provenanceRef);
  assert.equal(view.presentation.authoritative, false);
  assert.equal(view.presentation.physicalActuation, false);
});
