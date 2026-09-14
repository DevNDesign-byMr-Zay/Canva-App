import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';
import { mapCanvaHolographicInteractions } from '../../src/holographic-interaction-map.mjs';

const provenanceRef = 'prov:demo';

test('maps editable Canva interactions into advisory holographic targets', () => {
  const payload = compileAiHolographicScene({
    snapshotId: 'snap-1',
    provenanceRef,
    modelOutput: {
      intentVersion: 1,
      sceneId: 'scene-interaction-map-1',
      intent: 'inspect editable element',
      target: 'holo-mat',
      nodes: [
        {
          id: 'node-1',
          canvaElementId: 'el-7',
          role: 'alert',
          text: 'Inspect',
          interaction: { action: 'inspect' },
          position: { x: 1, y: 2, z: 3 },
        },
      ],
    },
  });
  const interactions = mapCanvaHolographicInteractions(payload);
  assert.equal(interactions[0].canvaElementId, 'el-7');
  assert.equal(interactions[0].target, 'el-7');
  assert.equal(interactions[0].advisoryOnly, true);
  assert.equal(interactions[0].physicalActuation, false);
});

test('rejects unsupported interaction actions', () => {
  const payload = compileAiHolographicScene({
    snapshotId: 'snap-2',
    provenanceRef,
    modelOutput: {
      intentVersion: 1,
      sceneId: 'scene-interaction-map-2',
      intent: 'inspect unsupported interaction safely',
      target: 'holo-mat',
      nodes: [
        {
          id: 'node-1',
          text: 'X',
          interaction: { action: 'launch' },
          position: { x: 0, y: 0, z: 0 },
        },
      ],
    },
  });
  assert.throws(
    () => mapCanvaHolographicInteractions(payload),
    /unsupported interaction action/,
  );
});
