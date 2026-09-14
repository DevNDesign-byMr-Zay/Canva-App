import { describe, expect, it } from 'vitest';
import { compileValidatedCanvaHolographicRoundtrip } from '../../src/holographic-scene-roundtrip.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

describe('holographic operator view integrity', () => {
  const modelOutput = {
    intentVersion: 1,
    target: 'volumetric-3d',
    nodes: [{ id: 'hero', text: 'Grid', x: 1, y: 2, z: 3, role: 'heading', canvaElementId: 'el-1' }],
  };

  it('rejects a tampered advisory view fingerprint', () => {
    const roundtrip = compileValidatedCanvaHolographicRoundtrip({
      modelOutput,
      snapshotId: 'snap-1',
      provenanceRef: 'prov-1',
      designId: 'design-1',
    });
    const view = buildHolographicOperatorView({ payload: roundtrip.payload });
    expect(validateHolographicOperatorView(view)).toBe(true);
    expect(validateHolographicOperatorView({ ...view, target: 'projector' })).toBe(false);
    expect(validateHolographicOperatorView({ ...view, presentation: { ...view.presentation, authoritative: true } })).toBe(false);
  });
});
