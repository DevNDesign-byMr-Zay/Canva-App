import { buildHolographicCanvaPayload } from './holographic-scene-adapter.mjs';

const INTENT_VERSION = 1;
const TARGETS = new Set(['holo-mat', 'projector', 'volumetric-3d', 'ar-vr', 'web-dashboard']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

/**
 * Validate the structured scene plan returned by an AI model and translate it
 * into the existing renderer-neutral Canva payload. Model output is never
 * treated as authoritative and never receives a hardware execution primitive.
 */
export function compileAiHolographicScene({ modelOutput, snapshotId, provenanceRef, designId = null } = {}) {
  const plan = object(modelOutput, 'modelOutput');
  if (plan.intentVersion !== INTENT_VERSION) throw new TypeError('modelOutput.intentVersion must equal 1');
  const target = text(plan.target ?? 'web-dashboard', 'modelOutput.target');
  if (!TARGETS.has(target)) throw new TypeError(`unsupported holographic target: ${target}`);
  const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
  const layers = {
    topology: nodes.map((node, index) => {
      const value = object(node, `modelOutput.nodes[${index}]`);
      return {
        id: text(value.id ?? `node-${index}`, `modelOutput.nodes[${index}].id`),
        kind: text(value.kind ?? 'asset', `modelOutput.nodes[${index}].kind`),
        position: {
          x: finite(value.x ?? 0, `modelOutput.nodes[${index}].x`),
          y: finite(value.y ?? 0, `modelOutput.nodes[${index}].y`),
          z: finite(value.z ?? 0, `modelOutput.nodes[${index}].z`),
        },
      };
    }),
    aiIntent: [text(plan.intent, 'modelOutput.intent')],
  };

  const scene = {
    sceneVersion: 2,
    snapshotId: text(snapshotId, 'snapshotId'),
    sceneId: text(plan.sceneId, 'modelOutput.sceneId'),
    provenanceRef: text(provenanceRef, 'provenanceRef'),
    rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
    layers,
    metrics: plan.metrics ?? null,
    proposal: null,
  };

  return buildHolographicCanvaPayload({ scene, target, designId });
}

export { INTENT_VERSION };
