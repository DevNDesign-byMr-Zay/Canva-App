export function createOptimizationReceipt({ problem, result, startedAt, durationMs } = {}) {
  if (!problem || typeof problem !== 'object') throw new TypeError('optimization problem is required.');
  if (!result || typeof result !== 'object') throw new TypeError('optimization result is required.');
  if (!Number.isFinite(result.objective)) throw new TypeError('optimization result objective is required.');
  if (startedAt !== undefined && typeof startedAt !== 'string') throw new TypeError('startedAt must be an ISO string.');
  if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0)) throw new TypeError('durationMs must be a non-negative number.');

  return {
    schema: 'canva-runtime-optimization-receipt-v1',
    problem: {
      kind: problem.kind,
      version: problem.version,
      variableCount: problem.linear.length,
    },
    solver: {
      backend: result.backend ?? 'unknown',
      algorithm: result.algorithm ?? 'unknown',
      seed: result.seed,
    },
    objective: result.objective,
    bits: Array.isArray(result.bits) ? [...result.bits] : undefined,
    startedAt,
    durationMs,
  };
}
