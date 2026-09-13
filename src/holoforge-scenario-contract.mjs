import { createHash } from 'node:crypto';

export const HOLOFORGE_SCENARIO_VERSION = 1;
export const HOLOFORGE_TARGET = 'web-dashboard';

const HEX_64 = /^[a-f0-9]{64}$/;
const DIRECTIONS = new Set(['maximize', 'minimize']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unsignedScenario(scenario) {
  const clone = structuredClone(scenario);
  if (isObject(clone.provenance)) delete clone.provenance.scenarioFingerprint;
  return clone;
}

function optimizationProblemDefinition(scenario) {
  return {
    sourceSnapshotFingerprint: scenario.source?.snapshotFingerprint ?? null,
    objective: {
      id: scenario.intent?.objectiveId ?? null,
      direction: scenario.intent?.objectiveDirection ?? null,
    },
    constraints: {
      hard: scenario.constraints?.hard ?? [],
      soft: scenario.constraints?.soft ?? [],
    },
  };
}

export function computeScenarioFingerprint(scenario) {
  if (!isObject(scenario)) throw new TypeError('scenario must be an object');
  return digest(unsignedScenario(scenario));
}

export function computeOptimizationFingerprint(scenario) {
  if (!isObject(scenario)) throw new TypeError('scenario must be an object');
  return digest(optimizationProblemDefinition(scenario));
}

export function computeObjectiveGap({ direction, candidateScore, baselineScore }) {
  if (!DIRECTIONS.has(direction)) throw new TypeError('objective direction must be maximize or minimize');
  if (!Number.isFinite(candidateScore) || !Number.isFinite(baselineScore)) {
    throw new TypeError('objective scores must be finite numbers');
  }
  return direction === 'maximize'
    ? baselineScore - candidateScore
    : candidateScore - baselineScore;
}

export function buildScenarioEnvelope(input = {}) {
  const scenario = structuredClone(input);
  scenario.contractVersion = HOLOFORGE_SCENARIO_VERSION;
  scenario.provenance = {
    ...(isObject(scenario.provenance) ? scenario.provenance : {}),
    scenarioFingerprint: '',
    optimizationFingerprint: '',
  };
  scenario.provenance.optimizationFingerprint = computeOptimizationFingerprint(scenario);
  scenario.provenance.scenarioFingerprint = computeScenarioFingerprint(scenario);
  return Object.freeze(scenario);
}

function collectStructuralReasons(scenario) {
  const reasons = [];

  if (!isObject(scenario)) return ['scenario must be an object'];
  if (scenario.contractVersion !== HOLOFORGE_SCENARIO_VERSION) reasons.push('unsupported contract version');
  if (!nonEmptyString(scenario.scenarioId)) reasons.push('missing scenario identity');

  const source = scenario.source;
  if (!isObject(source)) reasons.push('missing source identity');
  else {
    if (!nonEmptyString(source.designId)) reasons.push('missing source design identity');
    if (!nonEmptyString(source.snapshotId)) reasons.push('missing source snapshot identity');
    if (!Array.isArray(source.pageIds) || source.pageIds.length === 0 || source.pageIds.some((id) => !nonEmptyString(id))) {
      reasons.push('invalid source page identity');
    }
    if (!HEX_64.test(source.snapshotFingerprint ?? '')) reasons.push('invalid source snapshot fingerprint');
  }

  const intent = scenario.intent;
  if (!isObject(intent)) reasons.push('missing intent');
  else {
    if (!nonEmptyString(intent.summary)) reasons.push('missing intent summary');
    if (!nonEmptyString(intent.objectiveId)) reasons.push('missing objective identity');
    if (!DIRECTIONS.has(intent.objectiveDirection)) reasons.push('invalid objective direction');
  }

  const constraints = scenario.constraints;
  if (!isObject(constraints) || !Array.isArray(constraints.hard) || !Array.isArray(constraints.soft)) {
    reasons.push('invalid constraint sets');
  }

  const candidate = scenario.candidate;
  if (!isObject(candidate)) reasons.push('missing candidate');
  else {
    if (!isObject(candidate.layout)) reasons.push('invalid candidate layout');
    if (!Array.isArray(candidate.changedElementIds) || candidate.changedElementIds.some((id) => !nonEmptyString(id))) {
      reasons.push('invalid changed element scope');
    }
    if (!isObject(candidate.delta)) reasons.push('invalid candidate delta');
  }

  const evidence = scenario.evidence;
  if (!isObject(evidence)) reasons.push('missing evidence');
  else {
    if (!nonEmptyString(evidence.backend)) reasons.push('missing evidence backend');
    if (!nonEmptyString(evidence.algorithm)) reasons.push('missing evidence algorithm');
    if (!nonEmptyString(evidence.seed)) reasons.push('missing evidence seed');
    if (!nonEmptyString(evidence.status)) reasons.push('missing evidence status');
    if (!Number.isFinite(evidence.objectiveScore)) reasons.push('invalid candidate objective score');
    if (!Number.isFinite(evidence.objectiveGap)) reasons.push('invalid objective gap');
    if (!Number.isFinite(evidence.durationMs) || evidence.durationMs < 0) reasons.push('invalid duration');
    if (typeof evidence.hardConstraintsPassed !== 'boolean') reasons.push('missing hard-constraint status');
    if (!Array.isArray(evidence.warnings)) reasons.push('invalid evidence warnings');

    const baseline = evidence.baseline;
    if (!isObject(baseline)) reasons.push('missing classical baseline');
    else {
      if (!nonEmptyString(baseline.backend)) reasons.push('missing baseline backend');
      if (!nonEmptyString(baseline.algorithm)) reasons.push('missing baseline algorithm');
      if (!Number.isFinite(baseline.objectiveScore)) reasons.push('invalid baseline objective score');
    }

    if (
      isObject(intent)
      && DIRECTIONS.has(intent.objectiveDirection)
      && Number.isFinite(evidence.objectiveScore)
      && Number.isFinite(baseline?.objectiveScore)
      && Number.isFinite(evidence.objectiveGap)
    ) {
      const expectedGap = computeObjectiveGap({
        direction: intent.objectiveDirection,
        candidateScore: evidence.objectiveScore,
        baselineScore: baseline.objectiveScore,
      });
      if (Math.abs(expectedGap - evidence.objectiveGap) > Number.EPSILON * 16) {
        reasons.push('objective gap does not match measured scores');
      }
    }

    const optimizationFingerprint = scenario.provenance?.optimizationFingerprint;
    if (!HEX_64.test(optimizationFingerprint ?? '')) reasons.push('invalid optimization fingerprint');
    else if (optimizationFingerprint !== computeOptimizationFingerprint(scenario)) {
      reasons.push('optimization problem provenance mismatch');
    }
  }

  const interpretation = scenario.interpretation;
  if (!isObject(interpretation)) reasons.push('missing interpretation');
  else {
    if (interpretation.producer !== 'auren') reasons.push('unexpected interpretation producer');
    if (!nonEmptyString(interpretation.label)) reasons.push('missing scenario label');
    if (!nonEmptyString(interpretation.summary)) reasons.push('missing interpretation summary');
    if (!Array.isArray(interpretation.tradeoffs)) reasons.push('invalid interpretation tradeoffs');
  }

  const presentation = scenario.presentation;
  if (!isObject(presentation)) reasons.push('missing presentation safety');
  else {
    if (presentation.advisoryOnly !== true) reasons.push('scenario must remain advisory-only');
    if (presentation.autoApply !== false) reasons.push('auto-apply must remain disabled');
    if (presentation.target !== HOLOFORGE_TARGET) reasons.push('unsupported HoloForge target');
  }

  const fingerprint = scenario.provenance?.scenarioFingerprint;
  if (!HEX_64.test(fingerprint ?? '')) reasons.push('invalid scenario fingerprint');
  else if (fingerprint !== computeScenarioFingerprint(scenario)) reasons.push('scenario provenance mismatch');

  return reasons;
}

export function inspectScenarioEnvelope(
  scenario,
  {
    currentSnapshotFingerprint = null,
    selectedScenarioId = null,
    explicitApply = false,
  } = {},
) {
  const structuralReasons = collectStructuralReasons(scenario);
  const previewReasons = [...structuralReasons];

  if (structuralReasons.length === 0) {
    if (scenario.evidence.status !== 'complete') previewReasons.push('computation evidence is incomplete');
    if (scenario.evidence.hardConstraintsPassed !== true) previewReasons.push('hard constraints failed');
    if (
      currentSnapshotFingerprint != null
      && currentSnapshotFingerprint !== scenario.source.snapshotFingerprint
    ) {
      previewReasons.push('source snapshot is stale');
    }
  }

  const previewEnabled = previewReasons.length === 0;
  const applyReasons = [...previewReasons];

  if (previewEnabled) {
    if (selectedScenarioId !== scenario.scenarioId) applyReasons.push('scenario is not explicitly selected');
    if (explicitApply !== true) applyReasons.push('explicit apply action is required');
    if (currentSnapshotFingerprint == null) applyReasons.push('current source fingerprint is required');
  }

  return Object.freeze({
    valid: structuralReasons.length === 0,
    previewEnabled,
    applyEnabled: applyReasons.length === 0,
    structuralReasons: Object.freeze(structuralReasons),
    previewReasons: Object.freeze(previewReasons),
    applyReasons: Object.freeze(applyReasons),
  });
}

export function validateScenarioEnvelope(scenario) {
  return collectStructuralReasons(scenario).length === 0;
}
