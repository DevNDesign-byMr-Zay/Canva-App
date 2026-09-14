import { validateHolographicCanvaPayload } from './holographic-scene-adapter.mjs';

const ACTIONS = Object.freeze(['focus', 'select', 'inspect', 'activate', 'dismiss']);

export function mapCanvaHolographicInteractions(payload) {
  if (!validateHolographicCanvaPayload(payload)) throw new TypeError('payload failed holographic integrity validation');
  const interactions = [];
  for (const layer of payload.layers ?? []) {
    if (!Array.isArray(layer.data)) continue;
    for (const item of layer.data) {
      if (!item || typeof item !== 'object' || !item.interaction) continue;
      const action = item.interaction.action;
      if (!ACTIONS.includes(action)) throw new TypeError(`unsupported interaction action: ${action}`);
      const target = item.interaction.target ?? item.canvaElementId ?? item.id;
      if (typeof target !== 'string' || !target.trim()) throw new TypeError('interaction target must be a non-empty string');
      interactions.push(Object.freeze({
        canvaElementId: item.canvaElementId ?? null,
        target: target.trim(),
        action,
        advisoryOnly: true,
        physicalActuation: false,
      }));
    }
  }
  return Object.freeze(interactions);
}

export { ACTIONS as HOLOGRAPHIC_INTERACTION_ACTIONS };
