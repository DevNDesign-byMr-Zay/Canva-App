import { validateBinaryOptimizationResult } from './result-validation.mjs';

export function compareBinaryOptimization(problem, referenceResult, candidateResult) {
  validateBinaryOptimizationResult(problem, referenceResult);
  validateBinaryOptimizationResult(problem, candidateResult);
  const objectiveGap = candidateResult.objective - referenceResult.objective;
  return {
    referenceObjective: referenceResult.objective,
    candidateObjective: candidateResult.objective,
    objectiveGap,
    matchesReference: objectiveGap === 0,
  };
}
