import { describe, expect, it } from 'vitest';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';

describe('Canva holographic interaction safety', () => {
  it('preserves interaction metadata without granting physical authority', () => {
    const payload = compileAiHolographicScene({
      modelOutput: {
        intentVersion: 1,
        target: 'holo-mat',
        sceneId: 'scene-1',
        intent: 'inspect',
        nodes: [{ id: 'node-1', kind: 'asset', canvaElementId: 'el-1', interaction: { action: 'inspect', target: 'node-1' } }],
      },
      snapshotId: 'snapshot-1',
      provenanceRef: 'provenance-1',
      designId: 'design-1',
    });
    const topology = payload.layers.find((layer) => layer.type === 'topology');
    expect(topology.data[0].interaction).toEqual({ action: 'inspect', target: 'node-1' });
    expect(payload.safety.authoritative).toBe(false);
    expect(payload.safety.physicalActuation).toBe(false);
  });
});
