import { createHash } from 'node:crypto';
import {
  validateHolographicCanvaPayload,
  TARGETS,
} from './holographic-scene-adapter.mjs';

const VIEW_VERSION = 3;

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
function snapshot(value) {
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, snapshot(child)]),
    );
  }
  return value;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}
function severityRank(value) {
  return ({ critical: 0, high: 1, warning: 2, info: 3 })[value] ?? 4;
}
function unsignedView(value) {
  const { viewFingerprint: _viewFingerprint, ...unsigned } = value;
  return unsigned;
}

export function buildHolographicOperatorView({ payload, target = null } = {}) {
  const value = object(payload, 'payload');
  if (!validateHolographicCanvaPayload(value)) {
    throw new TypeError('payload failed holographic integrity validation');
  }
  const resolvedTarget = target ?? value.target;
  if (!TARGETS.includes(resolvedTarget)) {
    throw new TypeError(`unsupported holographic target: ${resolvedTarget}`);
  }

  const attention = [...(value.attention ?? [])]
    .map((item, index) => ({
      id: item.evidenceRef ?? `attention-${index + 1}`,
      priority: Number.isFinite(item.priority)
        ? item.priority
        : Number.MAX_SAFE_INTEGER,
      severity: item.severity,
      reason: item.reason,
      evidenceRef: item.evidenceRef,
      advisoryOnly: item.advisoryOnly === true,
    }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        severityRank(a.severity) - severityRank(b.severity) ||
        a.id.localeCompare(b.id),
    );

  const solverComparisonLayers = Array.isArray(value.layers)
    ? value.layers.filter(
        (layer) =>
          layer.type === 'solverComparison' && Array.isArray(layer.data),
      )
    : [];
  const candidates = snapshot(
    solverComparisonLayers.flatMap((layer) => layer.data),
  );

  const view = {
    viewVersion: VIEW_VERSION,
    source: {
      snapshotId: text(value.snapshotId, 'payload.snapshotId'),
      sceneId: text(value.sceneIdentity, 'payload.sceneIdentity'),
      provenanceRef: text(value.provenanceRef, 'payload.provenanceRef'),
      payloadFingerprint: value.payloadFingerprint,
    },
    target: resolvedTarget,
    attention,
    comparison: {
      candidateCount: candidates.length,
      candidates,
      metrics: snapshot(value.metrics ?? null),
    },
    presentation: {
      mode: 'operator-advisory',
      interaction: 'presentation-only',
      authoritative: false,
      physicalActuation: false,
    },
  };

  return deepFreeze({ ...view, viewFingerprint: digest(view) });
}

export function validateHolographicOperatorView(view) {
  try {
    const value = object(view, 'view');
    if (
      value.viewVersion !== VIEW_VERSION ||
      !TARGETS.includes(value.target) ||
      !value.source?.snapshotId ||
      !value.source?.sceneId ||
      !value.source?.provenanceRef ||
      !/^[a-f0-9]{64}$/.test(value.source?.payloadFingerprint) ||
      !Array.isArray(value.attention) ||
      !value.attention.every((item) => item.advisoryOnly === true) ||
      !Array.isArray(value.comparison?.candidates) ||
      value.comparison.candidateCount !== value.comparison.candidates.length ||
      value.presentation?.mode !== 'operator-advisory' ||
      value.presentation?.interaction !== 'presentation-only' ||
      value.presentation?.authoritative !== false ||
      value.presentation?.physicalActuation !== false ||
      !/^[a-f0-9]{64}$/.test(value.viewFingerprint)
    ) {
      return false;
    }
    return value.viewFingerprint === digest(unsignedView(value));
  } catch {
    return false;
  }
}

export { VIEW_VERSION };
