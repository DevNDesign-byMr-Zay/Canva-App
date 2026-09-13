const SCHEMA_VERSION = 1;
const STATUSES = Object.freeze(['candidate', 'ready', 'applied', 'rejected']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export function createHoloForgeScenario({
  scenarioId,
  sourceDesignRef,
  intent,
  constraints = [],
  candidateLayout,
  backend,
  seed,
  objectiveScore,
  delta,
  durationMs,
  status = 'candidate',
} = {}) {
  const scenario = {
    schemaVersion: SCHEMA_VERSION,
    scenarioId: text(scenarioId, 'scenarioId'),
    sourceDesignRef: text(sourceDesignRef, 'sourceDesignRef'),
    intent: text(intent, 'intent'),
    constraints: [...object(constraints, 'constraints')],
    candidateLayout: object(candidateLayout, 'candidateLayout'),
    backend: text(backend, 'backend'),
    seed,
    objectiveScore,
    delta,
    durationMs,
    status: text(status, 'status'),
  };

  if (!STATUSES.includes(scenario.status)) throw new TypeError(`unsupported scenario status: ${scenario.status}`);
  if (!Number.isFinite(scenario.objectiveScore)) throw new TypeError('objectiveScore must be finite');
  if (!Number.isFinite(scenario.delta)) throw new TypeError('delta must be finite');
  if (!Number.isFinite(scenario.durationMs) || scenario.durationMs < 0) throw new TypeError('durationMs must be a non-negative finite number');

  return Object.freeze(scenario);
}

export function validateHoloForgeScenario(value) {
  try {
    const scenario = object(value, 'scenario');
    return scenario.schemaVersion === SCHEMA_VERSION
      && typeof scenario.scenarioId === 'string' && scenario.scenarioId.trim().length > 0
      && typeof scenario.sourceDesignRef === 'string' && scenario.sourceDesignRef.trim().length > 0
      && typeof scenario.intent === 'string' && scenario.intent.trim().length > 0
      && Array.isArray(scenario.constraints)
      && scenario.candidateLayout && typeof scenario.candidateLayout === 'object' && !Array.isArray(scenario.candidateLayout)
      && typeof scenario.backend === 'string' && scenario.backend.trim().length > 0
      && Number.isFinite(scenario.objectiveScore)
      && Number.isFinite(scenario.delta)
      && Number.isFinite(scenario.durationMs) && scenario.durationMs >= 0
      && STATUSES.includes(scenario.status);
  } catch {
    return false;
  }
}

export { SCHEMA_VERSION, STATUSES };
