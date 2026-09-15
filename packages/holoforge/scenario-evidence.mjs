import { createEvidenceBundle } from './evidence-bundle.mjs';

export function attachScenarioEvidence(scenario, {
  candidate,
  reference = null,
  comparison = null,
} = {}) {
  if (!scenario || typeof scenario !== 'object') throw new TypeError('scenario is required');
  const evidence = createEvidenceBundle({
    scenarioId: scenario.scenarioId,
    sourceDesignRef: scenario.sourceDesignRef,
    objective: scenario.objective,
    candidate,
    reference,
    comparison,
  });

  return Object.freeze({
    ...scenario,
    status: 'evaluated',
    evidence,
  });
}
