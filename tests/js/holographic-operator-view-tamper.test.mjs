import test from 'node:test';
import assert from 'node:assert/strict';
import { compileValidatedCanvaHolographicRoundtrip } from '../../src/holographic-scene-roundtrip.mjs';
import {
  buildHolographicOperatorView,
  validateHolographicOperatorView,
} from '../../src/holographic-operator-view.mjs';

const modelOutput = {
  intentVersion: 1,
  sceneId: 'scene-operator-tamper-1',
  intent: 'inspect operator view integrity',
  target: 'volumetric-3d',
  nodes: [
    {
      id: 'hero',
      text: 'Grid',
      x: 1,
      y: 2,
      z: 3,
      role: 'heading',
      canvaElementId: 'el-1',
    },
  ],
};

test('rejects a tampered advisory view fingerprint', () => {
  const roundtrip = compileValidatedCanvaHolographicRoundtrip({
    modelOutput,
    snapshotId: 'snap-1',
    provenanceRef: 'prov-1',
    designId: 'design-1',
  });
  const view = buildHolographicOperatorView({ payload: roundtrip.payload });
  assert.equal(validateHolographicOperatorView(view), true);
  assert.equal(
    validateHolographicOperatorView({ ...view, target: 'projector' }),
    false,
  );
  assert.equal(
    validateHolographicOperatorView({
      ...view,
      presentation: { ...view.presentation, authoritative: true },
    }),
    false,
  );
});
