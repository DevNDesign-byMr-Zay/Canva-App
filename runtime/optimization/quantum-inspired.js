/**
 * Small deterministic optimization primitive for runtime-side experiments.
 * No cloud service, credentials, or quantum hardware required.
 */
function requireFiniteLinear(linear) {
  if (!Array.isArray(linear) || linear.length === 0) {
    throw new TypeError('linear coefficients are required.');
  }
  if (linear.some((coefficient) => !Number.isFinite(coefficient))) {
    throw new TypeError('linear coefficients must be finite numbers.');
  }
  return linear;
}

export function scoreBinary(linear, bits) {
  requireFiniteLinear(linear);
  if (!Array.isArray(bits) || linear.length !== bits.length) {
    throw new TypeError('linear coefficients and bits must have equal lengths.');
  }
  if (bits.some((bit) => bit !== 0 && bit !== 1)) {
    throw new TypeError('bits must contain only 0 or 1.');
  }
  return linear.reduce((sum, coefficient, index) => sum + coefficient * bits[index], 0);
}

export function optimizeBinary({ linear, seed = 1 } = {}) {
  requireFiniteLinear(linear);
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
