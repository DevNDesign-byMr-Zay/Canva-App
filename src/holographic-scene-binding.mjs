import { createHash } from 'node:crypto';
import { validateHolographicCanvaPayload } from './holographic-scene-adapter.mjs';
import { verifyHolographicCanvaScene } from './holographic-scene-fingerprint.mjs';

const BINDING_VERSION = 2;
const BUILD_INPUT_KEYS = Object.freeze(['scene', 'payload', 'sceneFingerprint']);
const BINDING_KEYS = Object.freeze([
  'bindingVersion',
  'snapshotId',
  'sceneId',
  'provenanceRef',
  'sceneFingerprint',
  'payloadFingerprint',
  'target',
  'designId',
  'safety',
  'bindingFingerprint',
]);
const SAFETY_KEYS = Object.freeze(['advisoryOnly', 'authoritative', 'physicalActuation']);

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
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
}

function snapshotArray(value, path, seen) {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  const allowedKeys = new Set(['length']);
  const copy = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) throw new TypeError(`${path} must not contain sparse arrays`);
    if ('get' in descriptor || 'set' in descriptor) {
      throw new TypeError(`${path}[${index}] must not use accessors`);
    }
    copy.push(snapshotEvidence(descriptor.value, `${path}[${index}]`, seen));
  }
  const unexpected = Reflect.ownKeys(value).find(
    (key) => typeof key !== 'string' || !allowedKeys.has(key),
  );
  if (unexpected !== undefined) throw new TypeError(`${path} arrays must not contain extra properties`);
  return Object.freeze(copy);
}

function snapshotObject(value, path, seen) {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must use plain objects`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  const copy = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable) throw new TypeError(`${path}.${key} must be enumerable evidence`);
    if ('get' in descriptor || 'set' in descriptor) {
      throw new TypeError(`${path}.${key} must not use accessors`);
    }
    Object.defineProperty(copy, key, {
      value: snapshotEvidence(descriptor.value, `${path}.${key}`, seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return Object.freeze(copy);
}

function snapshotEvidence(value, path, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${path} must contain JSON-compatible evidence`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);
  const copy = Array.isArray(value)
    ? snapshotArray(value, path, seen)
    : snapshotObject(value, path, seen);
  seen.delete(value);
  return copy;
}

function captureBuildInput(input) {
  const captured = snapshotEvidence(input, 'binding input');
  if (!hasExactKeys(captured, BUILD_INPUT_KEYS)) {
    throw new TypeError('binding input contains unsupported or missing fields');
  }
  return captured;
}

function unsignedBinding(value) {
  const { bindingFingerprint: _bindingFingerprint, ...unsigned } = value;
  return unsigned;
}

export function buildHolographicCanvaSceneBinding(input = {}) {
  const { scene, payload, sceneFingerprint } = captureBuildInput(input);

  if (!validateHolographicCanvaPayload(payload)) {
    throw new TypeError('payload failed holographic integrity validation');
  }
  if (typeof sceneFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(sceneFingerprint)) {
    throw new TypeError('sceneFingerprint must be a sha256 fingerprint');
  }
  if (!verifyHolographicCanvaScene(scene, sceneFingerprint)) {
    throw new TypeError('scene fingerprint failed holographic integrity validation');
  }

  const snapshotId = text(scene.snapshotId, 'scene.snapshotId');
  const sceneId = text(scene.sceneId, 'scene.sceneId');
  const provenanceRef = text(scene.provenanceRef, 'scene.provenanceRef');

  if (payload.snapshotId !== snapshotId) throw new TypeError('scene snapshotId must match payload');
  if (payload.sceneIdentity !== sceneId) throw new TypeError('scene sceneId must match payload');
  if (payload.provenanceRef !== provenanceRef) throw new TypeError('scene provenanceRef must match payload');

  const binding = {
    bindingVersion: BINDING_VERSION,
    snapshotId,
    sceneId,
    provenanceRef,
    sceneFingerprint,
    payloadFingerprint: payload.payloadFingerprint,
    target: text(payload.target, 'payload.target'),
    designId: payload.designId == null ? null : text(payload.designId, 'payload.designId'),
    safety: Object.freeze({
      advisoryOnly: true,
      authoritative: false,
      physicalActuation: false,
    }),
  };

  return Object.freeze({
    ...binding,
    bindingFingerprint: digest(binding),
  });
}

export function validateHolographicCanvaSceneBinding(binding) {
  try {
    const value = snapshotEvidence(binding, 'binding');
    if (!hasExactKeys(value, BINDING_KEYS)) return false;
    if (!hasExactKeys(value.safety, SAFETY_KEYS)) return false;
    if (
      value.bindingVersion !== BINDING_VERSION ||
      value.snapshotId !== text(value.snapshotId, 'binding.snapshotId') ||
      value.sceneId !== text(value.sceneId, 'binding.sceneId') ||
      value.provenanceRef !== text(value.provenanceRef, 'binding.provenanceRef') ||
      value.target !== text(value.target, 'binding.target') ||
      (value.designId !== null && value.designId !== text(value.designId, 'binding.designId')) ||
      !/^[a-f0-9]{64}$/.test(value.sceneFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.payloadFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.bindingFingerprint) ||
      value.safety.advisoryOnly !== true ||
      value.safety.authoritative !== false ||
      value.safety.physicalActuation !== false
    ) {
      return false;
    }
    return value.bindingFingerprint === digest(unsignedBinding(value));
  } catch {
    return false;
  }
}

export { BINDING_VERSION };
