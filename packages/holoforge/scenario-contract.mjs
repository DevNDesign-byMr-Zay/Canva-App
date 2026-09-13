/**
 * HOLOFORGE Scenario Contract v0.
 * Portable, inspectable candidate-future envelope for Canva-facing spatial scenarios.
 *
 * This module is intentionally provider-neutral: it records evidence but does not
 * select a solver, mutate a Canva design, or authorize an external action.
 */

const CONTRACT = 'holoforge.scenario';
const VERSION = '0';
const STATUSES = Object.freeze(['candidate', 'evaluated', 'selected', 'rejected']);

function nonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
}

function nonNegativeFinite(value, name) {
  finite(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
  return value;
}

function constraintList(value) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new TypeError('constraints must be an array of non-empty strings');
  }
  return value.map((item) => item.trim());
}

export function createScenario({
  scenarioId,
  sourceDesignRef,
  intent,
  constraints = [],
  layout,
  backend,
  algorithm,
  seed,
  objective,
  deltaFromSource,
  durationMs,
  status = 'candidate',
} = {}) {
  const scenario = {
    contract: CONTRACT,
    version: VERSION,
    scenarioId: nonEmpty(scenarioId, 'scenarioId'),
    sourceDesignRef: nonEmpty(sourceDesignRef, 'sourceDesignRef'),
    intent: nonEmpty(intent, 'intent'),
    constraints: constraintList(constraints),
    layout: object(layout, 'layout'),
    evidence: {
      backend: nonEmpty(backend, 'backend'),
      algorithm: nonEmpty(algorithm, 'algorithm'),
      seed: Number.isInteger(seed) && seed >= 0 ? seed : (() => { throw new TypeError('seed must be a non-negative integer'); })(),
      objective: finite(objective, 'objective'),
      deltaFromSource: finite(deltaFromSource, 'deltaFromSource'),
      durationMs: nonNegativeFinite(durationMs, 'durationMs'),
    },
    status: STATUSES.includes(status) ? status : (() => { throw new TypeError(`unsupported status: ${status}`); })(),
  };

  return Object.freeze({
    ...scenario,
    constraints: Object.freeze(scenario.constraints),
    layout: Object.freeze({ ...scenario.layout }),
    evidence: Object.freeze({ ...scenario.evidence }),
  });
}

export function validateScenario(value) {
  try {
    object(value, 'scenario');
    return value.contract === CONTRACT
      && value.version === VERSION
      && typeof value.scenarioId === 'string' && value.scenarioId.trim() !== ''
      && typeof value.sourceDesignRef === 'string' && value.sourceDesignRef.trim() !== ''
      && typeof value.intent === 'string' && value.intent.trim() !== ''
      && Array.isArray(value.constraints)
      && value.constraints.every((item) => typeof item === 'string' && item.trim() !== '')
      && value.layout && typeof value.layout === 'object' && !Array.isArray(value.layout)
      && value.evidence && typeof value.evidence === 'object'
      && typeof value.evidence.backend === 'string' && value.evidence.backend.trim() !== ''
      && typeof value.evidence.algorithm === 'string' && value.evidence.algorithm.trim() !== ''
      && Number.isInteger(value.evidence.seed) && value.evidence.seed >= 0
      && Number.isFinite(value.evidence.objective)
      && Number.isFinite(value.evidence.deltaFromSource)
      && Number.isFinite(value.evidence.durationMs) && value.evidence.durationMs >= 0
      && STATUSES.includes(value.status);
  } catch {
    return false;
  }
}

export { CONTRACT, VERSION, STATUSES };
