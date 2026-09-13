import { compileAiHolographicScene } from './ai-holographic-scene.mjs';
import { validateHolographicCanvaPayload } from './holographic-scene-adapter.mjs';
import { fingerprintHolographicCanvaScene } from './holographic-scene-fingerprint.mjs';

export function compileValidatedCanvaHolographicRoundtrip({ modelOutput, snapshotId, provenanceRef, designId = null } = {}) {
  const payload = compileAiHolographicScene({ modelOutput, snapshotId, provenanceRef, designId });
  if (!validateHolographicCanvaPayload(payload)) throw new TypeError('compiled Canva holographic payload failed adapter validation');
  const sceneForFingerprint = {
    sceneVersion: 2,
    snapshotId: payload.snapshotId,
    sceneId: payload.sceneIdentity,
    provenanceRef: payload.provenanceRef,
    layers: Object.fromEntries(payload.layers.map((layer) => [layer.type, layer.data])),
    metrics: payload.metrics,
    proposal: payload.proposal,
  };
  return Object.freeze({
    payload,
    sceneFingerprint: fingerprintHolographicCanvaScene(sceneForFingerprint),
    safety: Object.freeze({ authoritative: false, physicalActuation: false, advisoryOnly: true }),
  });
}
