import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAiHolographicScene } from '../../src/ai-holographic-scene.mjs';
import {
  buildHolographicOperatorView,
  validateHolographicOperatorView,
} from '../../src/holographic-operator-view.mjs';

test('operator view fingerprint covers interaction semantics', () => {
  const payload = compileAiHolographicScene({
    snapshotId: 'snapshot-interaction-integrity',
    provenanceRef: 'prov-interaction-integrity',
    designId: 'design-interaction-integrity',
    modelOutput: {
      intentVersion: 1,
      sceneId: 'scene-interaction-integrity',
      intent: 'inspect operator interaction integrity',
      target: 'volumetric-3d',
      nodes: [
        {
          id: 'node-1',
          canvaElementId: 'el-1',
          role: 'button',
          x: 1,
          y: 2,
          z: 3,
          interaction: { action: 'inspect', target: 'el-1' },
        },
      ],
    },
  });
  const view = buildHolographicOperatorView({ payload });
  assert.equal(validateHolographicOperatorView(view), true);
  assert.equal(view.interactions[0].target, 'el-1');
  assert.equal(view.interactions[0].action, 'inspect');

  const tampered = {
    ...view,
    interactions: [{ ...view.interactions[0], action: 'activate' }],
  };
  assert.equal(validateHolographicOperatorView(tampered), false);
});

test('operator view rejects interaction safety tampering', () => {
  const payload = compileAiHolographicScene({
    snapshotId: 'snapshot-interaction-safety',
    provenanceRef: 'prov-interaction-safety',
    designId: 'design-interaction-safety',
    modelOutput: {
      intentVersion: 1,
      sceneId: 'scene-interaction-safety',
      intent: 'verify interaction safety remains advisory',
      target: 'holo-mat',
      nodes: [{ id: 'node-1', x: 0, y: 0, z: 0, interaction: { action: 'select' } }],
    },
  });
  const view = buildHolographicOperatorView({ payload });
  const tampered = {
    ...view,
    interactions: [{ ...view.interactions[0], physicalActuation: true }],
  };
  assert.equal(validateHolographicOperatorView(tampered), false);
});
