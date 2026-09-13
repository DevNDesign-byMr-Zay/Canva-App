import { compileAiHolographicScene } from './ai-holographic-scene.mjs';
import { buildHolographicCanvaPayload } from './holographic-scene-adapter.mjs';
import { fingerprintHolographicCanvaScene } from './holographic-scene-fingerprint.mjs';

export function compileValidatedCanvaHolographicRoundtrip({ modelOutput, snapshotId, provenanceRef, designId = null } = {}) {
  const compiled = compileAiHolographicScene({ modelOutput, snapshotId, provenanceRef, designId });
  const scene = compiled.scene ?? compiled;
  const payload = buildHolographicCanvaPayload({ scene, target: compiled.target, designId });
  return Object.freeze({
    payload,
    sceneFingerprint: fingerprintHolographicCanvaScene(scene),
    safety: Object.freeze({ authoritative: false, physicalActuation: false, advisoryOnly: true }),
  });
}
