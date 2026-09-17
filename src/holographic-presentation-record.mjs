import { createHash } from 'node:crypto';
import { validateHolographicCanvaSceneBinding } from './holographic-scene-binding.mjs';
import { validateHolographicOperatorView } from './holographic-operator-view.mjs';

const PRESENTATION_RECORD_VERSION = 2;
const BUILD_INPUT_KEYS = Object.freeze(['binding', 'view']);
const RECORD_KEYS = Object.freeze([
  'recordVersion',
  'snapshotId',
  'sceneId',
  'provenanceRef',
  'designId',
  'target',
  'sceneFingerprint',
  'payloadFingerprint',
  'bindingFingerprint',
  'viewFingerprint',
  'presentation',
  'recordFingerprint',
]);
const PRESENTATION_KEYS = Object.freeze(['mode', 'authoritative', 'physicalActuation']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function snapshotArray(value, path, seen) {
  if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError(`${path} must not contain symbol properties`);
  const allowed = new Set(['length']);
  const copy = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowed.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) throw new TypeError(`${path} must not contain sparse arrays`);
    if ('get' in descriptor || 'set' in descriptor) throw new TypeError(`${path}[${index}] must not use accessors`);
    copy.push(snapshotEvidence(descriptor.value, `${path}[${index}]`, seen));
  }
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key))) {
    throw new TypeError(`${path} arrays must not contain extra properties`);
  }
  return Object.freeze(copy);
}

function snapshotObject(value, path, seen) {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must use plain objects`);
  if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError(`${path} must not contain symbol properties`);
  const copy = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!descriptor.enumerable) throw new TypeError(`${path}.${key} must be enumerable evidence`);
    if ('get' in descriptor || 'set' in descriptor) throw new TypeError(`${path}.${key} must not use accessors`);
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
  if (!value || typeof value !== 'object') throw new TypeError(`${path} must contain JSON-compatible evidence`);
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);
  const copy = Array.isArray(value)
    ? snapshotArray(value, path, seen)
    : snapshotObject(value, path, seen);
  seen.delete(value);
  return copy;
}

function captureBuildInput(input) {
  const captured = snapshotEvidence(input, 'presentation input');
  if (!hasExactKeys(captured, BUILD_INPUT_KEYS)) {
    throw new TypeError('presentation input contains unsupported or missing fields');
  }
  return captured;
}

function unsignedRecord(value) {
  const { recordFingerprint: _recordFingerprint, ...unsigned } = value;
  return unsigned;
}

export function buildHolographicPresentationRecord(input = {}) {
  const { binding, view } = captureBuildInput(input);

  if (!validateHolographicCanvaSceneBinding(binding)) {
    throw new TypeError('binding failed holographic integrity validation');
  }
  if (!validateHolographicOperatorView(view)) {
    throw new TypeError('view failed holographic integrity validation');
  }
  if (view.source.snapshotId !== binding.snapshotId) throw new TypeError('view snapshotId must match binding');
  if (view.source.sceneId !== binding.sceneId) throw new TypeError('view sceneId must match binding');
  if (view.source.provenanceRef !== binding.provenanceRef) throw new TypeError('view provenanceRef must match binding');
  if (view.source.payloadFingerprint !== binding.payloadFingerprint) throw new TypeError('view payloadFingerprint must match binding');
  if (view.target !== binding.target) throw new TypeError('view target must match binding');

  const record = {
    recordVersion: PRESENTATION_RECORD_VERSION,
    snapshotId: binding.snapshotId,
    sceneId: binding.sceneId,
    provenanceRef: binding.provenanceRef,
    designId: binding.designId,
    target: binding.target,
    sceneFingerprint: binding.sceneFingerprint,
    payloadFingerprint: binding.payloadFingerprint,
    bindingFingerprint: binding.bindingFingerprint,
    viewFingerprint: view.viewFingerprint,
    presentation: Object.freeze({
      mode: 'operator-advisory',
      authoritative: false,
      physicalActuation: false,
    }),
  };

  return Object.freeze({ ...record, recordFingerprint: digest(record) });
}

export function validateHolographicPresentationRecord(record) {
  try {
    const value = snapshotEvidence(record, 'presentation record');
    if (!hasExactKeys(value, RECORD_KEYS) || !hasExactKeys(value.presentation, PRESENTATION_KEYS)) return false;
    if (
      value.recordVersion !== PRESENTATION_RECORD_VERSION ||
      typeof value.snapshotId !== 'string' || !value.snapshotId.trim() ||
      typeof value.sceneId !== 'string' || !value.sceneId.trim() ||
      typeof value.provenanceRef !== 'string' || !value.provenanceRef.trim() ||
      typeof value.target !== 'string' || !value.target.trim() ||
      (value.designId !== null && (typeof value.designId !== 'string' || !value.designId.trim())) ||
      !/^[a-f0-9]{64}$/.test(value.sceneFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.payloadFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.bindingFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.viewFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.recordFingerprint) ||
      value.presentation.mode !== 'operator-advisory' ||
      value.presentation.authoritative !== false ||
      value.presentation.physicalActuation !== false
    ) return false;
    return value.recordFingerprint === digest(unsignedRecord(value));
  } catch {
    return false;
  }
}

export { PRESENTATION_RECORD_VERSION };
