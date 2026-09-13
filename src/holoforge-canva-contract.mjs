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

function reproducibilitySeed(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new TypeError('seed must be a finite number or non-empty string');
}

function validSeed(value) {
  return (typeof value === 'number' && Number.isFinite(value))
    || (typeof value === 'string' && value.trim().length > 0);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableCopy(value) {
  return deepFreeze(structuredClone(value));
}

function constraints(value) {
  if (!Array.isArray(value)) throw new TypeError('constraints must be an array');
  return Object.freeze(
    value.map((item, index) => immutableCopy(object(item, `constraints[${index}]`))),
  );
}

export function createHoloForgeScenario({
  scenarioId,
  sourceDesignRef,
  intent,
  constraints: rawConstraints = [],
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
    constraints: constraints(rawConstraints),
    candidateLayout: immutableCopy(object(candidateLayout, 'candidateLayout')),
    backend: text(backend, 'backend'),
    seed: reproducibilitySeed(seed),
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
      && scenario.constraints.every((item) => item && typeof item === 'object' && !Array.isArray(item))
      && scenario.candidateLayout && typeof scenario.candidateLayout === 'object' && !Array.isArray(scenario.candidateLayout)
      && typeof scenario.backend === 'string' && scenario.backend.trim().length > 0
      && validSeed(scenario.seed)
      && Number.isFinite(scenario.objectiveScore)
      && Number.isFinite(scenario.delta)
      && Number.isFinite(scenario.durationMs) && scenario.durationMs >= 0
      && STATUSES.includes(scenario.status);
  } catch {
    return false;
  }
}

export { SCHEMA_VERSION, STATUSES };
