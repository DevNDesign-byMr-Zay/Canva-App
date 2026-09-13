import { createHash } from 'node:crypto';
import {
  validateHolographicCanvaSceneBinding,
} from './holographic-scene-binding.mjs';
import { validateHolographicOperatorView } from './holographic-operator-view.mjs';

const PRESENTATION_RECORD_VERSION = 1;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
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

function unsignedRecord(value) {
  const { recordFingerprint: _recordFingerprint, ...unsigned } = value;
  return unsigned;
}

export function buildHolographicPresentationRecord({ binding, view } = {}) {
  const bindingValue = object(binding, 'binding');
  const viewValue = object(view, 'view');

  if (!validateHolographicCanvaSceneBinding(bindingValue)) {
    throw new TypeError('binding failed holographic integrity validation');
  }
  if (!validateHolographicOperatorView(viewValue)) {
    throw new TypeError('view failed holographic integrity validation');
  }

  if (viewValue.source.snapshotId !== bindingValue.snapshotId) {
    throw new TypeError('view snapshotId must match binding');
  }
  if (viewValue.source.sceneId !== bindingValue.sceneId) {
    throw new TypeError('view sceneId must match binding');
  }
  if (viewValue.source.provenanceRef !== bindingValue.provenanceRef) {
    throw new TypeError('view provenanceRef must match binding');
  }
  if (viewValue.source.payloadFingerprint !== bindingValue.payloadFingerprint) {
    throw new TypeError('view payloadFingerprint must match binding');
  }
  if (viewValue.target !== bindingValue.target) {
    throw new TypeError('view target must match binding');
  }

  const record = {
    recordVersion: PRESENTATION_RECORD_VERSION,
    snapshotId: bindingValue.snapshotId,
    sceneId: bindingValue.sceneId,
    provenanceRef: bindingValue.provenanceRef,
    designId: bindingValue.designId ?? null,
    target: bindingValue.target,
    sceneFingerprint: bindingValue.sceneFingerprint,
    payloadFingerprint: bindingValue.payloadFingerprint,
    bindingFingerprint: bindingValue.bindingFingerprint,
    viewFingerprint: viewValue.viewFingerprint,
    presentation: {
      mode: 'operator-advisory',
      authoritative: false,
      physicalActuation: false,
    },
  };

  return deepFreeze({
    ...record,
    recordFingerprint: digest(record),
  });
}

export function validateHolographicPresentationRecord(record) {
  try {
    const value = object(record, 'record');
    if (
      value.recordVersion !== PRESENTATION_RECORD_VERSION ||
      typeof value.snapshotId !== 'string' ||
      !value.snapshotId.trim() ||
      typeof value.sceneId !== 'string' ||
      !value.sceneId.trim() ||
      typeof value.provenanceRef !== 'string' ||
      !value.provenanceRef.trim() ||
      !/^[a-f0-9]{64}$/.test(value.sceneFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.payloadFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.bindingFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.viewFingerprint) ||
      !/^[a-f0-9]{64}$/.test(value.recordFingerprint) ||
      value.presentation?.mode !== 'operator-advisory' ||
      value.presentation?.authoritative !== false ||
      value.presentation?.physicalActuation !== false
    ) {
      return false;
    }

    return value.recordFingerprint === digest(unsignedRecord(value));
  } catch {
    return false;
  }
}

export { PRESENTATION_RECORD_VERSION };
