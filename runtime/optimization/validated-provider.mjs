import { normalizeBinaryOptimizationResult } from './result-validation.mjs';

/**
 * Wrap a runtime provider so its output is validated before it crosses the
 * maintained optimization boundary. The wrapper remains observational and
 * does not modify replay or provenance state.
 */
export function createValidatedProvider(provider) {
  if (!provider || typeof provider.solve !== 'function') {
    throw new TypeError('optimization provider must expose solve(problem).');
  }

  return Object.freeze({
    name: provider.name ?? 'validated-provider',
    solve(problem) {
      const result = provider.solve(problem);
      return normalizeBinaryOptimizationResult(problem, result).result;
    },
  });
}
