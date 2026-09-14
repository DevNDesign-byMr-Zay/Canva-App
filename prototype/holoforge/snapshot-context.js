/**
 * Browser-safe bridge for the current design snapshot identity.
 *
 * The prototype may use the fixture snapshot by default, but an embedding host
 * can provide the live snapshot fingerprint through the document root. This
 * makes stale-source gating real without importing Node-only contract code or
 * granting the prototype any mutation authority.
 */

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export function resolveCurrentSnapshotFingerprint({
  documentRoot = globalThis.document?.documentElement,
  fallbackFingerprint,
} = {}) {
  const hostFingerprint = documentRoot?.dataset?.sourceSnapshotFingerprint;
  if (typeof hostFingerprint === 'string' && FINGERPRINT_PATTERN.test(hostFingerprint)) {
    return hostFingerprint;
  }
  if (typeof fallbackFingerprint === 'string' && FINGERPRINT_PATTERN.test(fallbackFingerprint)) {
    return fallbackFingerprint;
  }
  return null;
}

export function isSnapshotCurrent(scenario, currentSnapshotFingerprint) {
  return Boolean(
    scenario
    && typeof scenario.sourceSnapshotFingerprint === 'string'
    && FINGERPRINT_PATTERN.test(scenario.sourceSnapshotFingerprint)
    && typeof currentSnapshotFingerprint === 'string'
    && FINGERPRINT_PATTERN.test(currentSnapshotFingerprint)
    && scenario.sourceSnapshotFingerprint === currentSnapshotFingerprint,
  );
}
