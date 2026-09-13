import { validateOptimizationMeasurement } from './measurement-contract.mjs';
import { createOptimizationReceipt } from './provenance.mjs';

/**
 * Convert a validated measurement into the maintained optimization receipt shape.
 * This is an observational bridge: it does not mutate replay or provenance state.
 */
export function createReceiptFromMeasurement(measurement, { startedAt } = {}) {
  validateOptimizationMeasurement(measurement);
  if (startedAt !== undefined && typeof startedAt !== 'string') {
    throw new TypeError('startedAt must be an ISO string.');
  }

  return createOptimizationReceipt({
    problem: {
      kind: measurement.problem.kind,
      version: measurement.problem.version,
      linear: new Array(measurement.problem.variableCount),
    },
    result: {
      backend: measurement.result.backend,
      algorithm: measurement.result.algorithm,
      objective: measurement.result.objective,
      bits: [...(measurement.result.bits ?? [])],
      seed: measurement.result.seed,
    },
    startedAt,
    durationMs: measurement.durationMs,
  });
}
