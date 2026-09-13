/**
 * Small deterministic optimization primitive for runtime-side experiments.
 * No cloud service, credentials, or quantum hardware required.
 */
export function scoreBinary(linear, bits) {
  if (!Array.isArray(linear) || !Array.isArray(bits) || linear.length !== bits.length) {
    throw new TypeError('linear coefficients and bits must have equal lengths.');
  }
  return linear.reduce((sum, coefficient, index) => sum + coefficient * bits[index], 0);
}

export function optimizeBinary({ linear, seed = 1 } = {}) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new TypeError('seed must be a non-negative integer.');
  }

  const bits = linear.map((coefficient) => (coefficient < 0 ? 1 : 0));
  return {
    backend: 'canva-runtime-qis-reference-v1',
    algorithm: 'exact-independent-binary-baseline',
    seed,
    bits,
    objective: scoreBinary(linear, bits),
  };
}
