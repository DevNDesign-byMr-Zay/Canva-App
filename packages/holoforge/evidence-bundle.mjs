/**
 * Portable evidence bundle for HOLOFORGE scenario comparisons.
 * Keeps orchestration and presentation separate from computation.
 */

const SCHEMA = 'holoforge.evidence-bundle';
const VERSION = '0';

function requiredString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function finiteOrNull(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite or null`);
  return value;
}

export function createEvidenceBundle({
  scenarioId,
  sourceDesignRef,
  objective,
  candidate,
  reference = null,
  comparison = null,
} = {}) {
  requiredString(scenarioId, 'scenarioId');
  requiredString(sourceDesignRef, 'sourceDesignRef');
  if (!objective || typeof objective !== 'object') throw new TypeError('objective is required');
  if (!candidate || typeof candidate !== 'object') throw new TypeError('candidate is required');

  const bundle = {
    schema: SCHEMA,
    version: VERSION,
    scenarioId,
    sourceDesignRef,
    objective: Object.freeze({ ...objective }),
    candidate: Object.freeze({ ...candidate }),
    reference: reference ? Object.freeze({ ...reference }) : null,
    comparison: comparison ? Object.freeze({ ...comparison }) : null,
    metrics: Object.freeze({
      candidateObjective: finiteOrNull(candidate.objective, 'candidate.objective'),
      referenceObjective: finiteOrNull(reference?.objective, 'reference.objective'),
      objectiveGap: finiteOrNull(comparison?.objectiveGap, 'comparison.objectiveGap'),
      relativeGap: finiteOrNull(comparison?.relativeGap, 'comparison.relativeGap'),
    }),
  };

  return Object.freeze(bundle);
}

export function validateEvidenceBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return false;
  if (bundle.schema !== SCHEMA || bundle.version !== VERSION) return false;
  if (typeof bundle.scenarioId !== 'string' || typeof bundle.sourceDesignRef !== 'string') return false;
  if (!bundle.objective || !bundle.candidate) return false;
  return true;
}
