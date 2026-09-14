import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';
import { mapCanvaHolographicInteractions } from '../../src/holographic-interaction-map.mjs';
import { buildHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

const modelOutput = {
  intentVersion: 1,
  sceneId: 'scene-interaction-roundtrip-1',
  intent: 'inspect selected design element',
  target: 'projector',
  nodes: [
    {
      id: 'node-1',
      canvaElementId: 'el-42',
      role: 'annotation',
      label: 'Inspect me',
      x: 10,
      y: 20,
      z: 2,
      interaction: { action: 'inspect', target: 'el-42' },
    },
  ],
};

test('preserves an editable Canva interaction through scene compilation and operator mapping', () => {
  const payload = compileAiHolographicScene({
    modelOutput,
    snapshotId: 'snap-1',
    provenanceRef: 'prov-1',
    designId: 'design-1',
  });
  const interactions = mapCanvaHolographicInteractions(payload);
  const view = buildHolographicOperatorView({ payload, target: 'projector' });

  assert.equal(interactions.length, 1);
  assert.deepEqual(interactions[0], {
    canvaElementId: 'el-42',
    target: 'el-42',
    action: 'inspect',
    advisoryOnly: true,
    physicalActuation: false,
  });
  assert.equal(view.presentation.authoritative, false);
  assert.equal(view.presentation.physicalActuation, false);
});

test('rejects an interaction target that is not a string at scene compilation', () => {
  assert.throws(
    () =>
      compileAiHolographicScene({
        modelOutput: {
          ...modelOutput,
          sceneId: 'scene-interaction-roundtrip-invalid',
          nodes: [
            {
              ...modelOutput.nodes[0],
              interaction: { action: 'inspect', target: 42 },
            },
          ],
        },
        snapshotId: 'snap-1',
        provenanceRef: 'prov-1',
        designId: 'design-1',
      }),
    /interaction\.target must be a non-empty string/,
  );
});
