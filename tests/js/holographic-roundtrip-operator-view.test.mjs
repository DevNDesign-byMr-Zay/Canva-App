import test from 'node:test';
import assert from 'node:assert/strict';
import { compileValidatedCanvaHolographicRoundtrip } from '../../src/holographic-scene-roundtrip.mjs';
import {
  buildHolographicOperatorView,
  validateHolographicOperatorView,
} from '../../src/holographic-operator-view.mjs';

test('feeds a validated AI scene into the advisory operator view', () => {
  const roundtrip = compileValidatedCanvaHolographicRoundtrip({
    snapshotId: 'snap-1',
    provenanceRef: 'prov-1',
    designId: 'design-1',
    modelOutput: {
      intentVersion: 1,
      sceneId: 'scene-roundtrip-operator-1',
      intent: 'present validated load state',
      target: 'volumetric-3d',
      nodes: [
        {
          id: 'node-1',
          label: 'Load',
          x: 1,
          y: 2,
          z: 3,
          role: 'load',
        },
      ],
      attention: [
        {
          priority: 1,
          severity: 'warning',
          reason: 'observe',
          evidenceRef: 'e-1',
        },
      ],
    },
  });
  const view = buildHolographicOperatorView({ payload: roundtrip.payload });
  assert.equal(validateHolographicOperatorView(view), true);
  assert.equal(view.source.snapshotId, 'snap-1');
  assert.equal(view.target, 'volumetric-3d');
  assert.equal(view.presentation.authoritative, false);
  assert.equal(view.presentation.physicalActuation, false);
});
