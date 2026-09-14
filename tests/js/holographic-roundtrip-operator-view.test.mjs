import { describe, expect, it } from 'vitest';
import { compileValidatedCanvaHolographicRoundtrip } from '../../src/holographic-scene-roundtrip.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from '../../src/holographic-operator-view.mjs';

describe('validated Canva holographic roundtrip', () => {
  it('feeds a validated AI scene into the advisory operator view', () => {
    const roundtrip = compileValidatedCanvaHolographicRoundtrip({
      snapshotId: 'snap-1',
      provenanceRef: 'prov-1',
      designId: 'design-1',
      modelOutput: {
        intentVersion: 1,
        target: 'volumetric-3d',
        nodes: [{ id: 'node-1', label: 'Load', x: 1, y: 2, z: 3, role: 'load' }],
        attention: [{ priority: 1, severity: 'warning', reason: 'observe', evidenceRef: 'e-1' }],
      },
    });
    const view = buildHolographicOperatorView({ payload: roundtrip.payload });
    expect(validateHolographicOperatorView(view)).toBe(true);
    expect(view.source.snapshotId).toBe('snap-1');
    expect(view.target).toBe('volumetric-3d');
    expect(view.presentation.authoritative).toBe(false);
    expect(view.presentation.physicalActuation).toBe(false);
  });
});
