import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';

test('preserves interaction metadata without granting physical authority', () => {
  const payload = compileAiHolographicScene({
    modelOutput: {
      intentVersion: 1,
      target: 'holo-mat',
      sceneId: 'scene-1',
      intent: 'inspect',
      nodes: [
        {
          id: 'node-1',
          kind: 'asset',
          canvaElementId: 'el-1',
          interaction: { action: 'inspect', target: 'node-1' },
        },
      ],
    },
    snapshotId: 'snapshot-1',
    provenanceRef: 'provenance-1',
    designId: 'design-1',
  });
  const topology = payload.layers.find((layer) => layer.type === 'topology');
  assert.deepEqual(topology.data[0].interaction, {
    action: 'inspect',
    target: 'node-1',
  });
  assert.equal(payload.safety.authoritative, false);
  assert.equal(payload.safety.physicalActuation, false);
});
