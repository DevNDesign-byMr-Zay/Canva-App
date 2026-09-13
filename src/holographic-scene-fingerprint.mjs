import { createHash } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function fingerprintHolographicCanvaScene(scene) {
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw new TypeError('scene must be an object');
  return createHash('sha256').update(JSON.stringify(canonical(scene)), 'utf8').digest('hex');
}

export function verifyHolographicCanvaScene(scene, fingerprint) {
  return typeof fingerprint === 'string' && fingerprint.length === 64 && fingerprintHolographicCanvaScene(scene) === fingerprint;
}
