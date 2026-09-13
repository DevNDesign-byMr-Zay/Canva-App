export const MEASUREMENT_SCHEMA = 'canva-runtime-optimization-measurement-v1';

export function validateOptimizationMeasurement(measurement) {
  if (!measurement || measurement.schema !== MEASUREMENT_SCHEMA) {
    throw new TypeError('expected version 1 optimization measurement.');
  }
  if (typeof measurement.provider !== 'string' || measurement.provider.length === 0) {
    throw new TypeError('measurement provider is required.');
  }
  if (!measurement.problem || measurement.problem.kind !== 'binary-linear' || measurement.problem.version !== 1) {
    throw new TypeError('measurement problem must be version 1 binary-linear.');
  }
  if (!measurement.result || !Number.isFinite(measurement.result.objective)) {
    throw new TypeError('measurement objective must be finite.');
  }
  if (!Number.isFinite(measurement.durationMs) || measurement.durationMs < 0) {
    throw new TypeError('measurement duration must be non-negative.');
  }
  return measurement;
}
