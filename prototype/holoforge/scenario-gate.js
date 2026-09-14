/**
 * Browser-safe Scenario Lab gate.
 *
 * This mirrors the contract's safety boundary without importing Node-only
 * provenance code. It selects validated presentation records and never
 * performs design mutation.
 */
export function findPrototypeScenario(scenarios, scenarioId) {
  if (!Array.isArray(scenarios) || typeof scenarioId !== 'string') return null;
  return scenarios.find((scenario) => scenario?.id === scenarioId) ?? null;
}

export function canApplyPrototypeScenario(
  scenario,
  { selectedScenarioId, currentSnapshotFingerprint, explicitApply = false } = {},
) {
  if (!scenario || typeof scenario !== 'object') return false;
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
  if (!scenario || typeof scenario !== 'object') {
    return Object.freeze({ canApply: false, blockReason: 'missing-scenario' });
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
