import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScenarioEnvelope,
  computeOptimizationFingerprint,
  inspectScenarioEnvelope,
  validateScenarioEnvelope,
} from '../../src/holoforge-scenario-contract.mjs';
import {
  hierarchyScenario,
  HOLOFORGE_SOURCE_FINGERPRINT,
  holoforgeScenarioFixtures,
} from '../../src/holoforge-fixtures.mjs';

test('all HoloForge fixtures satisfy Scenario Contract v1', () => {
  for (const scenario of holoforgeScenarioFixtures) {
    assert.equal(validateScenarioEnvelope(scenario), true);
  }
});

test('identical scenario inputs produce identical provenance', () => {
  const rebuilt = buildScenarioEnvelope(structuredClone({
    ...hierarchyScenario,
    provenance: {},
    contractVersion: undefined,
  }));

  assert.equal(rebuilt.provenance.scenarioFingerprint, hierarchyScenario.provenance.scenarioFingerprint);
  assert.equal(rebuilt.provenance.optimizationFingerprint, hierarchyScenario.provenance.optimizationFingerprint);
});

test('optimization identity is independent of candidate result metadata', () => {
  const variant = structuredClone(hierarchyScenario);
  variant.scenarioId = 'different-candidate-run';
  variant.candidate.layout.elements['headline-1'].scale = 1.35;
  variant.candidate.delta['headline-1'].scale = 0.35;
  variant.evidence.objectiveScore = 0.81;
  variant.evidence.objectiveGap = 0.14;
  variant.evidence.seed = 'different-seed';
  variant.evidence.backend = 'quantum-inspired-experimental';
  variant.evidence.durationMs = 999;

  assert.equal(computeOptimizationFingerprint(variant), hierarchyScenario.provenance.optimizationFingerprint);
  assert.notEqual(variant.scenarioId, hierarchyScenario.scenarioId);
});

test('optimization identity changes when the source problem changes', () => {
  const sourceChanged = structuredClone(hierarchyScenario);
  sourceChanged.source.snapshotFingerprint = 'b'.repeat(64);

  const objectiveChanged = structuredClone(hierarchyScenario);
  objectiveChanged.intent.objectiveId = 'different-objective-v1';

  const directionChanged = structuredClone(hierarchyScenario);
  directionChanged.intent.objectiveDirection = 'minimize';

  const constraintsChanged = structuredClone(hierarchyScenario);
  constraintsChanged.constraints.soft.push({ id: 'new-preference', type: 'spacing-preference', weight: 0.9 });

  const fingerprints = [
    computeOptimizationFingerprint(sourceChanged),
    computeOptimizationFingerprint(objectiveChanged),
    computeOptimizationFingerprint(directionChanged),
    computeOptimizationFingerprint(constraintsChanged),
  ];

  for (const fingerprint of fingerprints) {
    assert.notEqual(fingerprint, hierarchyScenario.provenance.optimizationFingerprint);
  }
});

test('tampered optimization identity fails provenance validation closed', () => {
  const tampered = structuredClone(hierarchyScenario);
  tampered.provenance.optimizationFingerprint = 'f'.repeat(64);

  assert.equal(validateScenarioEnvelope(tampered), false);
  assert.match(
    inspectScenarioEnvelope(tampered).structuralReasons.join(' '),
    /optimization problem provenance mismatch|scenario provenance mismatch/,
  );
});

test('scenario fingerprint remains result-sensitive while optimization identity stays stable', () => {
  const variant = structuredClone(hierarchyScenario);
  variant.evidence.objectiveScore = 0.91;
  variant.evidence.objectiveGap = 0.04;
  variant.provenance = {};
  const rebuilt = buildScenarioEnvelope(variant);

  assert.equal(rebuilt.provenance.optimizationFingerprint, hierarchyScenario.provenance.optimizationFingerprint);
  assert.notEqual(rebuilt.provenance.scenarioFingerprint, hierarchyScenario.provenance.scenarioFingerprint);
});

test('preview is allowed only with matching current source fingerprint', () => {
  const ready = inspectScenarioEnvelope(hierarchyScenario, {
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });
  assert.equal(ready.previewEnabled, true);
  assert.equal(ready.applyEnabled, false);

  const stale = inspectScenarioEnvelope(hierarchyScenario, {
    currentSnapshotFingerprint: 'b'.repeat(64),
  });
  assert.equal(stale.previewEnabled, false);
  assert.match(stale.previewReasons.join(' '), /stale/);
});

test('apply requires explicit selection, current source identity, and explicit action', () => {
  const gated = inspectScenarioEnvelope(hierarchyScenario, {
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
    selectedScenarioId: hierarchyScenario.scenarioId,
  });
  assert.equal(gated.previewEnabled, true);
  assert.equal(gated.applyEnabled, false);

  const ready = inspectScenarioEnvelope(hierarchyScenario, {
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
    selectedScenarioId: hierarchyScenario.scenarioId,
    explicitApply: true,
  });
  assert.equal(ready.applyEnabled, true);
});

test('tampered evidence fails provenance validation closed', () => {
  const tampered = structuredClone(hierarchyScenario);
  tampered.evidence.objectiveScore = 999;

  assert.equal(validateScenarioEnvelope(tampered), false);
  const gate = inspectScenarioEnvelope(tampered, {
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });
  assert.equal(gate.previewEnabled, false);
  assert.match(gate.structuralReasons.join(' '), /provenance mismatch|objective gap/);
});

test('hard-constraint failure blocks preview even when provenance is valid', () => {
  const failed = buildScenarioEnvelope({
    ...structuredClone(hierarchyScenario),
    evidence: {
      ...structuredClone(hierarchyScenario.evidence),
      hardConstraintsPassed: false,
    },
    provenance: {},
  });

  assert.equal(validateScenarioEnvelope(failed), true);
  const gate = inspectScenarioEnvelope(failed, {
    currentSnapshotFingerprint: HOLOFORGE_SOURCE_FINGERPRINT,
  });
  assert.equal(gate.previewEnabled, false);
  assert.match(gate.previewReasons.join(' '), /hard constraints failed/);
});

test('incomplete evidence remains structurally inspectable but cannot preview', () => {
  const pending = buildScenarioEnvelope({
    ...structuredClone(hierarchyScenario),
    evidence: {
      ...structuredClone(hierarchyScenario.evidence),
      status: 'running',
    },
    provenance: {},
  });

  assert.equal(validateScenarioEnvelope(pending), true);
  assert.equal(inspectScenarioEnvelope(pending).previewEnabled, false);
});
