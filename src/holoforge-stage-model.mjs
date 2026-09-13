import { createHash } from 'node:crypto';
import { inspectScenarioEnvelope } from './holoforge-scenario-contract.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableCopy(value) {
  if (value == null) return value;
  return deepFreeze(structuredClone(value));
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

export function buildHoloforgeStageModel({
  scenario,
  currentSnapshotFingerprint = null,
  selectedScenarioId = null,
  explicitApply = false,
} = {}) {
  const gates = inspectScenarioEnvelope(scenario, {
    currentSnapshotFingerprint,
    selectedScenarioId,
    explicitApply,
  });

  const model = {
    scenarioId: scenario?.scenarioId ?? null,
    status: gates.previewEnabled ? (gates.applyEnabled ? 'apply-ready' : 'preview-ready') : 'blocked',
    source: immutableCopy(scenario?.source ?? null),
    intent: immutableCopy(scenario?.intent ?? null),
    interpretation: immutableCopy(scenario?.interpretation ?? null),
    evidence: immutableCopy(scenario?.evidence ?? null),
    comparison: gates.previewEnabled
      ? {
          original: {
            snapshotId: scenario.source.snapshotId,
            fingerprint: scenario.source.snapshotFingerprint,
          },
          candidate: {
            layout: immutableCopy(scenario.candidate.layout),
            changedElementIds: immutableCopy(scenario.candidate.changedElementIds),
            delta: immutableCopy(scenario.candidate.delta),
          },
          layers: [
            'source-frame',
            'candidate-frame',
            'changed-elements',
            'constraint-boundaries',
            'relationship-lines',
            'attention-annotations',
            'evidence-markers',
          ],
        }
      : null,
    controls: {
      depth: true,
      scrub: true,
      branchSwitching: true,
      relationshipLines: true,
      attentionOverlay: true,
      evidenceMarkers: true,
      resetView: true,
      mutation: false,
    },
    gates,
  };

  return deepFreeze({
    ...model,
    stageIdentity: digest(model),
  });
}
