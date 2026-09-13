export function createBinaryProblem({ linear } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  return { kind: 'binary-linear', version: 1, linear: [...linear] };
}

export function runOptimization(provider, problem) {
  if (!problem || problem.kind !== 'binary-linear' || problem.version !== 1) {
    throw new TypeError('expected version 1 binary-linear problem.');
  }
  if (!provider || typeof provider.solve !== 'function') {
    throw new TypeError('optimization provider must expose solve(problem).');
  }
  return { problemKind: problem.kind, problemVersion: problem.version, ...provider.solve(problem) };
}
