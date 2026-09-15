import { createHash } from 'node:crypto';
import { validateHolographicCanvaPayload } from './holographic-scene-adapter.mjs';
import { verifyHolographicCanvaScene } from './holographic-scene-fingerprint.mjs';

const BINDING_VERSION = 1;

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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function unsignedBinding(value) {
  const { bindingFingerprint: _bindingFingerprint, ...unsigned } = value;
  return unsigned;
}

export function buildHolographicCanvaSceneBinding({
  scene,
  payload,
  sceneFingerprint,
} = {}) {
  const sceneValue = object(scene, 'scene');
  const payloadValue = object(payload, 'payload');

  if (!validateHolographicCanvaPayload(payloadValue)) {
    throw new TypeError('payload failed holographic integrity validation');
  }
  if (!verifyHolographicCanvaScene(sceneValue, sceneFingerprint)) {
    throw new TypeError('scene fingerprint failed holographic integrity validation');
  }

  const snapshotId = text(sceneValue.snapshotId, 'scene.snapshotId');
  const sceneId = text(sceneValue.sceneId, 'scene.sceneId');
  const provenanceRef = text(sceneValue.provenanceRef, 'scene.provenanceRef');

  if (payloadValue.snapshotId !== snapshotId) {
    throw new TypeError('scene snapshotId must match payload');
  }
  if (payloadValue.sceneIdentity !== sceneId) {
    throw new TypeError('scene sceneId must match payload');
  }
  if (payloadValue.provenanceRef !== provenanceRef) {
    throw new TypeError('scene provenanceRef must match payload');
  }

  const binding = {
    bindingVersion: BINDING_VERSION,
    snapshotId,
    sceneId,
    provenanceRef,
    sceneFingerprint,
    payloadFingerprint: payloadValue.payloadFingerprint,
    target: payloadValue.target,
    designId: payloadValue.designId ?? null,
    safety: {
      advisoryOnly: true,
      authoritative: false,
      physicalActuation: false,
    },
  };

  return deepFreeze({
    ...binding,
    bindingFingerprint: digest(binding),
  });
}

export function validateHolographicCanvaSceneBinding(binding) {
  try {
    const value = object(binding, 'binding');
    if (
      value.bindingVersion !== BINDING_VERSION ||
      !text(value.snapshotId, 'binding.snapshotId') ||
      !text(value.sceneId, 'binding.sceneId') ||
      !text(value.provenanceRef, 'binding.provenanceRef') ||
      !/^[a-f0-9]{64}$/.test(value.sceneFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.payloadFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.bindingFingerprint) ||
      value.safety?.advisoryOnly !== true ||
      value.safety?.authoritative !== false ||
      value.safety?.physicalActuation !== false
    ) {
      return false;
    }

    return value.bindingFingerprint === digest(unsignedBinding(value));
  } catch {
    return false;
  }
}

export { BINDING_VERSION };
