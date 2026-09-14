/**
 * Browser-safe Scenario Lab gate.
 *
 * This mirrors the contract's safety boundary without importing Node-only
 * provenance code. It selects validated presentation records and never
 * performs design mutation.
 */
const FINGERPRINT = /^[a-f0-9]{64}$/;

export function validatePrototypeScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') return false;
  return typeof scenario.id === 'string'
    && scenario.id.length > 0
    && typeof scenario.title === 'string'
    && typeof scenario.interpretation === 'string'
    && Number.isFinite(scenario.score)
    && Number.isFinite(scenario.baseline)
    && Number.isFinite(scenario.gap)
    && Number.isInteger(scenario.durationMs)
    && scenario.durationMs >= 0
    && typeof scenario.objective === 'string'
    && typeof scenario.seed === 'string'
    && typeof scenario.backend === 'string'
    && typeof scenario.algorithm === 'string'
    && typeof scenario.baselineBackend === 'string'
    && typeof scenario.baselineAlgorithm === 'string'
    && (scenario.status === 'complete' || scenario.status === 'partial' || scenario.status === 'running' || scenario.status === 'failed')
    && typeof scenario.hardConstraintsPassed === 'boolean'
    && Array.isArray(scenario.changedElementIds)
    && FINGERPRINT.test(scenario.sourceSnapshotFingerprint)
    && FINGERPRINT.test(scenario.optimizationFingerprint)
    && FINGERPRINT.test(scenario.scenarioFingerprint)
    && typeof scenario.target === 'string';
}

export function findPrototypeScenario(scenarios, scenarioId) {
  if (!Array.isArray(scenarios) || typeof scenarioId !== 'string') return null;
  return scenarios.find((scenario) => scenario?.id === scenarioId) ?? null;
}

export function canApplyPrototypeScenario(
  scenario,
  { selectedScenarioId, currentSnapshotFingerprint, explicitApply = false } = {},
) {
  if (!validatePrototypeScenario(scenario)) return false;
  return scenario.status === 'complete'
    && scenario.hardConstraintsPassed === true
    && scenario.sourceSnapshotFingerprint === currentSnapshotFingerprint
    && selectedScenarioId === scenario.id
    && explicitApply === true;
}

/**
 * Return a stable UI-facing decision without exposing internal validation
 * details or performing any design mutation.
 */
export function getPrototypeApplyState(
  scenario,
  { selectedScenarioId, currentSnapshotFingerprint, explicitApply = false } = {},
) {
  if (!validatePrototypeScenario(scenario)) {
    return Object.freeze({ canApply: false, blockReason: 'invalid-evidence' });
  }
  if (scenario.status !== 'complete') {
    return Object.freeze({ canApply: false, blockReason: 'incomplete-evidence' });
  }
  if (scenario.hardConstraintsPassed !== true) {
    return Object.freeze({ canApply: false, blockReason: 'hard-constraint-failure' });
  }
  if (scenario.sourceSnapshotFingerprint !== currentSnapshotFingerprint) {
    return Object.freeze({ canApply: false, blockReason: 'stale-source' });
  }
  if (selectedScenarioId !== scenario.id) {
    return Object.freeze({ canApply: false, blockReason: 'scenario-not-selected' });
  }
  if (explicitApply !== true) {
    return Object.freeze({ canApply: false, blockReason: 'explicit-apply-required' });
  }
  return Object.freeze({ canApply: true, blockReason: null });
}
