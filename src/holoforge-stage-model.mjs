import { createHash } from 'node:crypto';
import { inspectScenarioEnvelope } from './holoforge-scenario-contract.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
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
    source: scenario?.source ?? null,
    intent: scenario?.intent ?? null,
    interpretation: scenario?.interpretation ?? null,
    evidence: scenario?.evidence ?? null,
    comparison: gates.previewEnabled
      ? {
          original: {
            snapshotId: scenario.source.snapshotId,
            fingerprint: scenario.source.snapshotFingerprint,
          },
          candidate: {
            layout: scenario.candidate.layout,
            changedElementIds: scenario.candidate.changedElementIds,
            delta: scenario.candidate.delta,
          },
          layers: Object.freeze([
            'source-frame',
            'candidate-frame',
            'changed-elements',
            'constraint-boundaries',
            'relationship-lines',
            'attention-annotations',
            'evidence-markers',
          ]),
        }
      : null,
    controls: Object.freeze({
      depth: true,
      scrub: true,
      branchSwitching: true,
      relationshipLines: true,
      attentionOverlay: true,
      evidenceMarkers: true,
      resetView: true,
      mutation: false,
    }),
    gates,
  };

  return Object.freeze({
    ...model,
    stageIdentity: digest(model),
  });
}
