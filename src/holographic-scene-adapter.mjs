import { createHash } from 'node:crypto';

const ADAPTER_VERSION = 2;
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
function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
  }
  return value;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

export function buildHolographicCanvaPayload({ scene, target = 'web-dashboard', designId = null } = {}) {
  const value = object(scene, 'scene');
  if (value.sceneVersion !== 2) throw new TypeError('scene.sceneVersion must equal 2');
  if (!TARGETS.includes(target)) throw new TypeError(`unsupported holographic target: ${target}`);
  const snapshotId = text(value.snapshotId, 'scene.snapshotId');
  const sceneIdentity = text(value.sceneId, 'scene.sceneId');
  const provenanceRef = text(value.provenanceRef, 'scene.provenanceRef');
  const layers = object(value.layers, 'scene.layers');
  const attentionItems = Array.isArray(layers.attention) ? layers.attention : [];
  const layerPayload = Object.entries(layers).map(([type, data]) => ({ id: type, type, data }));

  const payload = deepFreeze(cloneValue({
    adapterVersion: ADAPTER_VERSION,
    authoritativeSource: value.rendererContract?.authoritativeSource ?? 'thergrid-decision-receipt',
    target,
    snapshotId,
    designId: designId == null ? null : text(designId, 'designId'),
    sceneIdentity,
    provenanceRef,
    layers: layerPayload,
    attention: attentionItems.map((item) => ({
      priority: item.priority,
      severity: text(item.severity, 'attention.severity'),
      reason: text(item.reason, 'attention.reason'),
      evidenceRef: item.evidenceRef == null ? null : text(item.evidenceRef, 'attention.evidenceRef'),
      advisoryOnly: item.advisoryOnly === true
    })),
    proposal: value.proposal ?? null,
    metrics: value.metrics ?? null,
  }));

  return Object.freeze({
    ...payload,
    payloadFingerprint: digest(payload),
    safety: Object.freeze({ authoritative: false, physicalActuation: false, provenanceRequired: true }),
  });
}

function fingerprintInput(payload) {
  const {
    payloadFingerprint: _payloadFingerprint,
    safety: _safety,
    ...unsignedPayload
  } = payload;
  return unsignedPayload;
}

export function validateHolographicCanvaPayload(payload) {
  try {
    const value = object(payload, 'payload');
    return value.adapterVersion === ADAPTER_VERSION
      && value.authoritativeSource === 'thergrid-decision-receipt'
      && TARGETS.includes(value.target)
      && typeof value.snapshotId === 'string' && value.snapshotId.trim().length > 0
      && typeof value.sceneIdentity === 'string' && value.sceneIdentity.trim().length > 0
      && typeof value.provenanceRef === 'string' && value.provenanceRef.trim().length > 0
      && /^[a-f0-9]{64}$/.test(value.payloadFingerprint)
      && value.payloadFingerprint === digest(fingerprintInput(value))
      && value.safety?.authoritative === false
      && value.safety?.physicalActuation === false
      && value.safety?.provenanceRequired === true;
  } catch {
    return false;
  }
}

export { ADAPTER_VERSION, TARGETS };
