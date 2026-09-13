import { buildHolographicCanvaPayload } from './holographic-scene-adapter.mjs';

const INTENT_VERSION = 1;
const TARGETS = new Set([
  'holo-mat',
  'projector',
  'volumetric-3d',
  'ar-vr',
  'web-dashboard',
]);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegative(value, name) {
  const result = finite(value, name);
  if (result < 0) throw new TypeError(`${name} must be greater than or equal to zero`);
  return result;
}

function optionalText(value, name) {
  return value == null ? null : text(value, name);
}

/**
 * Validate the structured scene plan returned by an AI model and translate it
 * into the existing renderer-neutral Canva payload. Model output is never
 * treated as authoritative and never receives a hardware execution primitive.
 */
export function compileAiHolographicScene({
  modelOutput,
  snapshotId,
  provenanceRef,
  designId = null,
} = {}) {
  const plan = object(modelOutput, 'modelOutput');
  if (plan.intentVersion !== INTENT_VERSION) {
    throw new TypeError('modelOutput.intentVersion must equal 1');
  }
  const target = text(plan.target ?? 'web-dashboard', 'modelOutput.target');
  if (!TARGETS.has(target)) throw new TypeError(`unsupported holographic target: ${target}`);
  const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
  const layers = {
    topology: nodes.map((node, index) => {
      const value = object(node, `modelOutput.nodes[${index}]`);
      const animation =
        value.animation == null
          ? null
          : object(value.animation, `modelOutput.nodes[${index}].animation`);
      const interaction =
        value.interaction == null
          ? null
          : object(value.interaction, `modelOutput.nodes[${index}].interaction`);
      return {
        id: text(value.id ?? `node-${index}`, `modelOutput.nodes[${index}].id`),
        kind: text(value.kind ?? 'asset', `modelOutput.nodes[${index}].kind`),
        position: {
          x: finite(value.x ?? 0, `modelOutput.nodes[${index}].x`),
          y: finite(value.y ?? 0, `modelOutput.nodes[${index}].y`),
          z: finite(value.z ?? 0, `modelOutput.nodes[${index}].z`),
        },
        style:
          value.style == null ? null : object(value.style, `modelOutput.nodes[${index}].style`),
        animation:
          animation == null
            ? null
            : {
                mode: text(animation.mode, `modelOutput.nodes[${index}].animation.mode`),
                durationMs: nonNegative(
                  animation.durationMs ?? 0,
                  `modelOutput.nodes[${index}].animation.durationMs`,
                ),
                loop: animation.loop === true,
              },
        interaction:
          interaction == null
            ? null
            : {
                action: text(
                  interaction.action,
                  `modelOutput.nodes[${index}].interaction.action`,
                ),
                target: optionalText(
                  interaction.target,
                  `modelOutput.nodes[${index}].interaction.target`,
                ),
              },
      };
    }),
    aiIntent: [text(plan.intent, 'modelOutput.intent')],
  };

  const attention = Array.isArray(plan.attention)
    ? plan.attention.map((item, index) => {
        const value = object(item, `modelOutput.attention[${index}]`);
        return {
          priority: finite(value.priority ?? index, `modelOutput.attention[${index}].priority`),
          severity: text(value.severity ?? 'info', `modelOutput.attention[${index}].severity`),
          reason: text(value.reason, `modelOutput.attention[${index}].reason`),
          evidenceRef: optionalText(
            value.evidenceRef,
            `modelOutput.attention[${index}].evidenceRef`,
          ),
          advisoryOnly: true,
        };
      })
    : [];

  const scene = {
    sceneVersion: 2,
    snapshotId: text(snapshotId, 'snapshotId'),
    sceneId: text(plan.sceneId, 'modelOutput.sceneId'),
    provenanceRef: text(provenanceRef, 'provenanceRef'),
    rendererContract: { authoritativeSource: 'thergrid-decision-receipt' },
    layers: { ...layers, attention },
    metrics: plan.metrics ?? null,
    proposal: null,
  };

  return buildHolographicCanvaPayload({ scene, target, designId });
}

export { INTENT_VERSION };
