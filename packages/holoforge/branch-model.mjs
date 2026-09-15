import { createScenario, validateScenario } from './scenario-contract.mjs';

/**
 * Scenario Forking is a pure data operation: source designs remain untouched.
 * The caller supplies candidate layouts/evidence and HOLOFORGE wraps them as
 * independently inspectable futures.
 */
export function forkScenarios({ sourceDesignRef, intent, constraints = [], candidates = [] } = {}) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  return Object.freeze(candidates.map((candidate, index) => {
    const scenario = createScenario({
      ...candidate,
      scenarioId: candidate.scenarioId ?? `scenario-${index + 1}`,
      sourceDesignRef,
      intent,
      constraints,
    });
    if (!validateScenario(scenario)) throw new TypeError('candidate did not satisfy Scenario Contract v0');
    return scenario;
  }));
}
