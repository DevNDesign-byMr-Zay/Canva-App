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
