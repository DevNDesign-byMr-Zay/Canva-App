/**
 * Browser-safe diagnostics for the Scenario Lab apply gate.
 *
 * The result is explanatory only: it does not mutate the design and does not
 * replace the canonical scenario validator.
 */
export function getPrototypeApplyBlockReason(
  scenario,
  { selectedScenarioId, currentSnapshotFingerprint, explicitApply = false } = {},
) {
  if (!scenario || typeof scenario !== 'object') return 'missing-scenario';
  if (scenario.status !== 'complete') return 'incomplete-evidence';
  if (scenario.hardConstraintsPassed !== true) return 'hard-constraint-failure';
  if (scenario.sourceSnapshotFingerprint !== currentSnapshotFingerprint) return 'stale-source';
  if (selectedScenarioId !== scenario.id) return 'scenario-not-selected';
  if (explicitApply !== true) return 'explicit-apply-required';
  return null;
}
