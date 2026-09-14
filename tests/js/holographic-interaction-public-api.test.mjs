import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCanvaHolographicInteractions,
  HOLOGRAPHIC_INTERACTION_ACTIONS,
} from '../../src/holographic-interaction-map.mjs';
import { buildHolographicCanvaPayload } from '../../src/holographic-scene-adapter.mjs';

test('public interaction mapper preserves advisory interaction semantics', () => {
  const scene = {
    sceneVersion: 2,
    sceneId: 'scene-1',
    snapshotId: 'snapshot-1',
    provenanceRef: 'prov-1',
    rendererContract: {
      mode: 'renderer-neutral',
      authoritativeSource: 'thergrid-decision-receipt',
    },
    layers: {
      topology: [
        {
          id: 'node-1',
          canvaElementId: 'el-1',
          role: 'button',
          interaction: { action: 'inspect' },
          x: 1,
          y: 2,
          z: 3,
        },
      ],
    },
  };
  const payload = buildHolographicCanvaPayload({
    scene,
    target: 'projector',
    designId: 'design-1',
  });
  const interactions = mapCanvaHolographicInteractions(payload);
  assert.equal(interactions.length, 1);
  assert.deepEqual(interactions[0], {
    canvaElementId: 'el-1',
    target: 'el-1',
    action: 'inspect',
    advisoryOnly: true,
    physicalActuation: false,
  });
  assert.ok(HOLOGRAPHIC_INTERACTION_ACTIONS.includes('inspect'));
});
