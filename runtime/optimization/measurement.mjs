import { normalizeBinaryOptimizationResult } from './result-validation.mjs';

/**
 * Measure a validated runtime provider without changing replay state.
 * The returned record is suitable for diagnostics and comparison only.
 */
export function measureOptimization(provider, problem, { now = Date.now } = {}) {
  if (!provider || typeof provider.solve !== 'function') {
    throw new TypeError('optimization provider must expose solve(problem).');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function.');

  const startedAt = now();
  const result = normalizeBinaryOptimizationResult(problem, provider.solve(problem)).result;
  const endedAt = now();
  const durationMs = endedAt - startedAt;

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError('measurement clock must be monotonic.');
  }

  return Object.freeze({
    schema: 'canva-runtime-optimization-measurement-v1',
    provider: provider.name ?? 'unknown',
    problem: {
      kind: problem.kind,
      version: problem.version,
      variableCount: problem.linear.length,
    },
    result: {
      backend: result.backend ?? null,
      algorithm: result.algorithm ?? null,
      seed: result.seed ?? null,
      objective: result.objective,
      bits: [...result.bits],
    },
    durationMs,
  });
}
