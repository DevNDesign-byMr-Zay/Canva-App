import { createHash } from 'node:crypto';

const ADAPTER_VERSION = 1;
const TARGETS = Object.freeze(['holo-mat', 'projector', 'volumetric-3d', 'ar-vr', 'web-dashboard']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

export function buildHolographicCanvaPayload({ scene, target = 'web-dashboard', designId = null } = {}) {
  const value = object(scene, 'scene');
  if (value.sceneVersion !== 2) throw new TypeError('scene.sceneVersion must equal 2');
  if (!TARGETS.includes(target)) throw new TypeError(`unsupported holographic target: ${target}`);
  const snapshotId = text(value.snapshotId, 'scene.snapshotId');
  const provenanceRef = text(value.provenanceRef, 'scene.provenanceRef');

  const payload = {
    adapterVersion: ADAPTER_VERSION,
    authoritativeSource: value.rendererContract?.authoritativeSource ?? 'thergrid-decision-receipt',
    target,
    snapshotId,
    designId: designId == null ? null : text(designId, 'designId'),
    sceneIdentity: text(value.sceneId, 'scene.sceneId'),
    provenanceRef,
    layers: Array.isArray(value.layers) ? value.layers.map((layer) => ({
      id: text(layer.id ?? layer.type, 'layer.id'),
      type: text(layer.type, 'layer.type'),
      visible: layer.visible !== false,
    })) : [],
    attention: Array.isArray(value.attention) ? value.attention.map((item) => ({
      priority: item.priority ?? 'normal',
      severity: item.severity ?? 'info',
      reason: text(item.reason, 'attention.reason'),
      evidenceRef: text(item.evidenceRef, 'attention.evidenceRef'),
      advisoryOnly: item.advisoryOnly === true,
    })) : [],
  };

  return Object.freeze({
    ...payload,
    payloadFingerprint: digest(payload),
    safety: Object.freeze({ authoritative: false, physicalActuation: false, provenanceRequired: true }),
  });
}

export function validateHolographicCanvaPayload(payload) {
  try {
    const value = object(payload, 'payload');
    return value.adapterVersion === ADAPTER_VERSION
      && value.authoritativeSource === 'thergrid-decision-receipt'
      && TARGETS.includes(value.target)
      && value.safety?.authoritative === false
      && value.safety?.physicalActuation === false
      && value.safety?.provenanceRequired === true
      && typeof value.payloadFingerprint === 'string';
  } catch {
    return false;
  }
}

export { ADAPTER_VERSION, TARGETS };
