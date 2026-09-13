export function validateBinaryOptimizationResult(problem, result) {
  if (!problem || problem.kind !== 'binary-linear' || problem.version !== 1) {
    throw new TypeError('expected version 1 binary-linear problem.');
  }
  if (!result || !Array.isArray(result.bits) || result.bits.length !== problem.linear.length) {
    throw new TypeError('optimization result bits must match the problem variable count.');
  }
  if (result.bits.some((bit) => bit !== 0 && bit !== 1)) {
    throw new TypeError('optimization result bits must be binary.');
  }
  if (typeof result.objective !== 'number' || !Number.isFinite(result.objective)) {
    throw new TypeError('optimization result objective must be finite.');
  }
  return result;
}

export function normalizeBinaryOptimizationResult(problem, result) {
  validateBinaryOptimizationResult(problem, result);
  return {
    problem: { kind: problem.kind, version: problem.version, linear: [...problem.linear] },
    result: { ...result, bits: [...result.bits] },
  };
}
