import { compileValidatedCanvaHolographicRoundtrip } from './holographic-scene-roundtrip.mjs';
import { buildHolographicOperatorView, validateHolographicOperatorView } from './holographic-operator-view.mjs';

export function buildValidatedCanvaHolographicOperatorView({ modelOutput, snapshotId, provenanceRef, designId = null, target = null } = {}) {
  const roundtrip = compileValidatedCanvaHolographicRoundtrip({ modelOutput, snapshotId, provenanceRef, designId });
  const view = buildHolographicOperatorView({ payload: roundtrip.payload, target });
  if (!validateHolographicOperatorView(view)) throw new TypeError('compiled Canva holographic operator view failed validation');
  return Object.freeze({
    roundtrip,
    view,
    safety: Object.freeze({ authoritative: false, physicalActuation: false, advisoryOnly: true }),
  });
}

export { buildHolographicOperatorView, validateHolographicOperatorView };
